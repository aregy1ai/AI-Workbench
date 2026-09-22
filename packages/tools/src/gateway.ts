/**
 * AI Workbench - Central Tool Gateway
 * Sprint 4: Policy Engine & Tool Gateway
 */

import { ToolRequest, ToolResponse, ToolDefinition } from "../../contracts/src/tool";
import { ExecutionContextPayload } from "../../contracts/src/execution-context";
import { executionContextSigner } from "../../security/src/context-signer";
import { toolRegistry } from "./registry";
import { toolCallRepository } from "./idempotency";
import { toolExecutor } from "./executor";
import { policyEngine, policyRepository } from "../../policy/src/engine";
import { approvalService } from "../../approvals/src/service";
import { secretBroker } from "../../secrets/src/broker";
import { SecretLease } from "../../secrets/src/lease";
import { redact } from "../../audit/src/redaction";
import { auditService } from "../../audit/src/service";
import { runRepository } from "../../runs/src/run-repository";
import { budgetGuard } from "../../budget/src/guard";
import { validateReadFileInput } from "./tools/repo-read-file";
import { validateListTreeInput } from "./tools/repo-list-tree";
import { validateCreateBranchInput } from "./tools/repo-create-branch";

export function assertRequestMatchesContext(
  request: ToolRequest,
  context: ExecutionContextPayload
): void {
  if (request.tenantId !== context.tenantId) {
    throw new Error("TENANT_SCOPE_INVALID");
  }
  if (request.workspaceId !== context.workspaceId) {
    throw new Error("WORKSPACE_SCOPE_INVALID");
  }
  if (request.runId !== context.runId) {
    throw new Error("RUN_SCOPE_INVALID");
  }
  if (request.stepId !== context.stepId) {
    throw new Error("STEP_SCOPE_INVALID");
  }
  if (request.actor.id !== context.actorId) {
    throw new Error("ACTOR_SCOPE_INVALID");
  }
}

export function validateToolInput(tool: ToolDefinition, input: unknown): unknown {
  if (tool.name === "repo.read_file") {
    return validateReadFileInput(input);
  }
  if (tool.name === "repo.list_tree") {
    return validateListTreeInput(input);
  }
  if (tool.name === "repo.create_branch") {
    return validateCreateBranchInput(input);
  }
  return input;
}

export class ToolGateway {
  /**
   * Central tool execution pipeline:
   * Verification -> Scoping -> Cancellation check -> Idempotency -> Policy -> Budget -> Secret Lease -> Execution -> Redaction -> Audit -> Revocation
   */
  public async execute(request: ToolRequest): Promise<ToolResponse> {
    // 1. Verify Signed Execution Context
    const context = await executionContextSigner.verify(request.contextToken);

    // 2. Validate Scopes Match
    assertRequestMatchesContext(request, context);

    // 3. Resolve Tool
    const tool = toolRegistry.resolve(request.toolName, request.toolVersion);

    // 4. Validate Schema Input
    validateToolInput(tool, request.input);

    // 5. Scoped Run & Cancellation Check
    const run = runRepository.get(context.runId);
    if (!run || run.tenantId !== context.tenantId) {
      return {
        status: "rejected",
        code: "RUN_NOT_FOUND",
        reason: "Run not found or scoped to another tenant",
        auditEventId: `audit_rej_${Date.now()}`,
        retryable: false,
      };
    }

    if (run.cancellationEpoch !== context.cancellationEpoch) {
      return {
        status: "rejected",
        code: "RUN_CANCELLED",
        reason: `Run was cancelled. Expected epoch ${context.cancellationEpoch}, but run is at epoch ${run.cancellationEpoch}`,
        auditEventId: `audit_rej_${Date.now()}`,
        retryable: false,
      };
    }

    if (["cancellation_requested", "cancelling", "cancelled", "failed"].includes(run.status)) {
      return {
        status: "rejected",
        code: "RUN_CANCELLED",
        reason: `Run is in non-executable state '${run.status}'`,
        auditEventId: `audit_rej_${Date.now()}`,
        retryable: false,
      };
    }

    // 6. Idempotency Check
    const existing = await toolCallRepository.findByIdempotencyKey(request.idempotencyKey);
    if (existing) {
      return toolCallRepository.toResponse(existing);
    }

    // 7. Create Tool Call Record
    const toolCall = await toolCallRepository.create({
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      runId: context.runId,
      stepId: context.stepId,
      toolName: tool.name,
      toolVersion: tool.version,
      idempotencyKey: request.idempotencyKey,
      requestHash: `h_${Math.random().toString(36).substring(2, 9)}`,
    });

    // 8. Policy Evaluation
    const remainingBudget = run.budgetLimit - run.budgetConsumed - run.budgetReserved;
    const policy = await policyEngine.evaluate({
      context,
      tool,
      input: request.input,
      actorRoles: ["developer"], // Role assigned to agent context
      runStatus: run.status,
      remainingBudget,
    });

    policyRepository.save(toolCall.id, policy);

    if (policy.decision === "deny") {
      await toolCallRepository.reject(toolCall.id, policy.reasonCode);

      const auditEventId = await auditService.record({
        eventType: "tool.call.rejected",
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
        runId: context.runId,
        stepId: context.stepId,
        actorType: context.actorType || "agent",
        actorId: context.actorId,
        policyVersion: policy.policyVersion,
        payload: {
          toolName: tool.name,
          reasonCode: policy.reasonCode,
        },
      });

      return {
        status: "rejected",
        code: "POLICY_DENIED",
        reason: policy.reasonCode,
        auditEventId,
        retryable: false,
      };
    }

    if (policy.decision === "approval_required") {
      const approval = await approvalService.create(request, policy, toolCall.id);
      await toolCallRepository.waitForApproval(toolCall.id, approval.id);

      const auditEventId = await auditService.record({
        eventType: "tool.call.approval_required",
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
        runId: context.runId,
        stepId: context.stepId,
        actorType: context.actorType || "agent",
        actorId: context.actorId,
        policyVersion: policy.policyVersion,
        payload: {
          toolName: tool.name,
          approvalId: approval.id,
          approvalType: approval.approvalType,
        },
      });

      return {
        status: "requires_approval",
        approvalId: approval.id,
        auditEventId,
        retryable: false,
      };
    }

    // 9. Budget Reservation
    let activeRun = run;
    if (tool.maximumCost > 0) {
      const res = budgetGuard.reserve(activeRun, tool.maximumCost, `Reserve for tool ${tool.name}`);
      if (!res.ok) {
        return {
          status: "rejected",
          code: "BUDGET_EXCEEDED",
          reason: res.error.message,
          auditEventId: `audit_rej_${Date.now()}`,
          retryable: false,
        };
      }
      activeRun = res.value;
      runRepository.save(activeRun);
    }

    let lease: SecretLease | undefined;

    try {
      // 10. Issue short-lived secret lease if tool requires credentials
      if (tool.secretRequirements.length > 0) {
        lease = await secretBroker.issue(request, tool, toolCall.id);
      }

      await toolCallRepository.markExecuting(toolCall.id, lease?.id);

      // 11. Execute Tool
      const rawResult = await toolExecutor.execute(tool, request.input, {
        lease,
        timeoutMs: tool.maximumRuntimeMs,
      });

      // 12. Output Redaction
      const safeResult = redact(rawResult);
      const artifactIds = [`art_${Math.random().toString(36).substring(2, 9)}`];

      // 13. Audit Event
      const auditEventId = await auditService.record({
        eventType: "tool.call.completed",
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
        runId: context.runId,
        stepId: context.stepId,
        actorType: context.actorType || "agent",
        actorId: context.actorId,
        policyVersion: policy.policyVersion,
        payload: {
          toolName: tool.name,
          toolCallId: toolCall.id,
          artifactIds,
        },
      });

      // 14. Settle Budget
      if (tool.maximumCost > 0) {
        activeRun = budgetGuard.settle(activeRun, tool.maximumCost, tool.maximumCost, `Settled for ${tool.name}`);
        runRepository.save(activeRun);
      }

      const response: ToolResponse = {
        status: "succeeded",
        result: safeResult,
        artifactIds,
        auditEventId,
        retryable: false,
      };

      await toolCallRepository.complete(toolCall.id, `hash_${Date.now()}`, response);
      return response;
    } catch (error: any) {
      if (tool.maximumCost > 0) {
        activeRun = budgetGuard.release(activeRun, tool.maximumCost, `Released for ${tool.name}`);
        runRepository.save(activeRun);
      }

      await toolCallRepository.fail(toolCall.id, error.message || "EXECUTION_ERROR");

      const auditEventId = await auditService.record({
        eventType: "tool.call.failed",
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
        runId: context.runId,
        stepId: context.stepId,
        actorType: context.actorType || "agent",
        actorId: context.actorId,
        policyVersion: policy.policyVersion,
        payload: {
          toolName: tool.name,
          error: error.message,
        },
      });

      return {
        status: "failed",
        code: error.message || "EXECUTION_ERROR",
        auditEventId,
        retryable: false,
      };
    } finally {
      // 15. Guaranteed Secret Revocation
      if (lease) {
        await secretBroker.revoke(lease.id);
      }
    }
  }

  /**
   * Compatibility runner for UI simulator
   */
  public async executeTool(
    input: any,
    currentRun: any
  ): Promise<{ response: any; updatedRun: any }> {
    let contextToken = input.contextToken;
    const tool = toolRegistry.resolve(input.toolName, input.toolVersion);

    // If contextToken is a mock JSON string from the simulator
    if (!contextToken || typeof contextToken === "string" && contextToken.startsWith("{")) {
      contextToken = await executionContextSigner.create({
        issuer: "workbench-control-plane",
        keyId: "key-v1",
        tenantId: currentRun.tenantId,
        workspaceId: currentRun.workspaceId,
        runId: currentRun.id,
        stepId: input.stepId || "step_01",
        actorId: "usr_agent_01",
        requestedAction: input.toolName,
        riskLevel: tool.riskLevel,
        policyVersion: "v1.1",
        cancellationEpoch: currentRun.cancellationEpoch || 0,
      });
    }

    // Ensure run is in repository
    runRepository.save(currentRun);

    const request: ToolRequest = {
      toolName: input.toolName,
      toolVersion: input.toolVersion || "1.0.0",
      tenantId: currentRun.tenantId,
      workspaceId: currentRun.workspaceId,
      runId: currentRun.id,
      stepId: input.stepId || "step_01",
      actor: { type: "agent", id: "usr_agent_01" },
      input: input.input || {},
      requestedCapabilities: tool.networkRequirements || [],
      idempotencyKey: input.idempotencyKey || `idem_${Date.now()}`,
      contextToken,
    };

    const res = await this.execute(request);
    const updatedRun = runRepository.get(currentRun.id) || currentRun;

    const enrichedResponse = {
      ...res,
      durationMs: 84,
      cost: tool.maximumCost || 0,
      reasonCode: (res as any).reason || "SUCCESS",
    };

    return {
      response: enrichedResponse,
      updatedRun,
    };
  }
}

export const toolGateway = new ToolGateway();
