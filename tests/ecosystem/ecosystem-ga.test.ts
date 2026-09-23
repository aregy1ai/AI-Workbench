/**
 * AI Workbench - Sprint 11 GA & Ecosystem Platform Test Suite
 * Sprint 11: General Availability & Ecosystem Platform
 */

import { apiKeyService } from "../../packages/api/src/keys";
import { publicApiRouter } from "../../packages/api/src/routes";
import { WorkbenchClient } from "../../packages/sdk/src/client";
import { WorkbenchError } from "../../packages/sdk/src/errors";
import { webhookDispatcher } from "../../packages/webhooks/src/dispatcher";
import { toolMarketplace } from "../../packages/marketplace/src/registry";
import { billingEngine } from "../../packages/billing/src/reconciliation";
import { changeGovernance, GA_LAUNCH_GATES } from "../../packages/governance/src/change-governance";

export interface EcosystemTestResult {
  suite: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

export async function runEcosystemTestSuite(): Promise<EcosystemTestResult[]> {
  const results: EcosystemTestResult[] = [];
  const testTenant = "tenant_ga_acme";

  // 1. SCOPED API KEY CREATION & OPERATION CHECK
  const keyGen = apiKeyService.generateKey("CI Automation Key", {
    tenantId: testTenant,
    workspaceIds: ["ws_main"],
    allowedOperations: ["POST:tasks", "POST:runs", "GET:runs"],
    allowedRepositories: ["org/repo-prod"],
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    rateLimitProfile: "standard",
  });

  const validOpCheck = apiKeyService.verifyKey(
    keyGen.rawKey,
    "POST:tasks",
    "ws_main",
    "org/repo-prod"
  );
  const invalidOpCheck = apiKeyService.verifyKey(
    keyGen.rawKey,
    "POST:delete_repo",
    "ws_main",
    "org/repo-prod"
  );

  results.push({
    suite: "Public API Authentication",
    name: "verifies scoped credentials and blocks forbidden operations",
    passed: validOpCheck.valid && !invalidOpCheck.valid,
    expected: "validOpCheck: true, invalidOpCheck: false",
    actual: `valid: ${validOpCheck.valid}, invalid: ${invalidOpCheck.valid}`,
    details: invalidOpCheck.rejectionReason,
  });

  // 2. API KEY REVOCATION
  apiKeyService.revokeKey(keyGen.keyId);
  const postRevokeCheck = apiKeyService.verifyKey(keyGen.rawKey, "POST:tasks");

  results.push({
    suite: "Public API Authentication",
    name: "immediately halts requests with revoked API keys",
    passed: !postRevokeCheck.valid && postRevokeCheck.rejectionReason === "KEY_REVOKED",
    expected: "rejectionReason: KEY_REVOKED",
    actual: `valid: ${postRevokeCheck.valid}, reason: ${postRevokeCheck.rejectionReason}`,
  });

  // 3. PUBLIC API V1 ENDPOINTS & ENVELOPE FORMAT
  const activeKeyGen = apiKeyService.generateKey("Active Prod Key", {
    tenantId: testTenant,
    workspaceIds: ["*"],
    allowedOperations: ["*"],
    allowedRepositories: ["*"],
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    rateLimitProfile: "unlimited",
  });

  const taskResponse = await publicApiRouter.handleRequest(
    "POST",
    "/v1/tasks",
    activeKeyGen.rawKey,
    { title: "GA Production Refactor", prompt: "Fix authentication timeout in auth.ts" }
  );

  const hasStandardEnvelope =
    taskResponse.status === 201 &&
    "data" in taskResponse.body &&
    Boolean((taskResponse.body as any).requestId) &&
    Boolean((taskResponse.body as any).auditEventId);

  results.push({
    suite: "Public API v1 Contract",
    name: "returns unified envelope with requestId and auditEventId",
    passed: hasStandardEnvelope,
    expected: "status: 201 with data, requestId and auditEventId",
    actual: `status: ${taskResponse.status}, envelope: ${hasStandardEnvelope}`,
  });

  // 4. IDEMPOTENT RUN CREATION CACHING
  const idemKey = `idem_test_${Date.now()}`;
  const runPayload = {
    taskId: "task_ga_001",
    workspaceId: "ws_main",
    budgetLimit: 40.0,
  };

  const firstRunCall = await publicApiRouter.handleRequest(
    "POST",
    "/v1/runs",
    activeKeyGen.rawKey,
    runPayload,
    idemKey
  );

  const secondRunCall = await publicApiRouter.handleRequest(
    "POST",
    "/v1/runs",
    activeKeyGen.rawKey,
    runPayload,
    idemKey
  );

  const isReplayed =
    (secondRunCall.body as any).idempotentReplay === true &&
    (firstRunCall.body as any).data.id === (secondRunCall.body as any).data.id;

  results.push({
    suite: "Public API v1 Contract",
    name: "guarantees idempotent run execution via replay cache",
    passed: isReplayed,
    expected: "idempotentReplay: true with identical Run ID",
    actual: `replayed: ${(secondRunCall.body as any).idempotentReplay}`,
  });

  // 5. CLIENT SDK TYPED ERRORS
  const sdk = new WorkbenchClient({ apiKey: "wbk_invalid_key_999" });
  let caughtWorkbenchError = false;

  try {
    await sdk.createTask("Test SDK Error Handling");
  } catch (err: any) {
    if (err instanceof WorkbenchError && err.code === "UNAUTHORIZED") {
      caughtWorkbenchError = true;
    }
  }

  results.push({
    suite: "Client SDK",
    name: "maps HTTP error statuses to typed WorkbenchError instances",
    passed: caughtWorkbenchError,
    expected: "instanceof WorkbenchError with code UNAUTHORIZED",
    actual: `caughtWorkbenchError: ${caughtWorkbenchError}`,
  });

  // 6. WEBHOOK HMAC SIGNATURE & REPLAY PREVENT
  const webhookEndpoint = webhookDispatcher.registerEndpoint(
    testTenant,
    "https://api.acme.corp/webhooks/workbench",
    ["run.completed"]
  );

  const dispatched = await webhookDispatcher.dispatchEvent(
    testTenant,
    "run.completed",
    "evt_test_999",
    { runId: "run_ga_test", status: "succeeded" }
  );

  const delivery = dispatched[0];
  const payloadStr = JSON.stringify(delivery.payload);

  const sigValid = webhookDispatcher.verifySignature(
    payloadStr,
    delivery.signature,
    webhookEndpoint.secret,
    delivery.timestamp
  );

  const replaySigDenied = webhookDispatcher.verifySignature(
    payloadStr,
    delivery.signature,
    webhookEndpoint.secret,
    delivery.timestamp - 10 * 60 * 1000 // 10 minutes ago
  );

  results.push({
    suite: "Webhooks Dispatcher",
    name: "verifies HMAC signatures and rejects replayed timestamps",
    passed: sigValid && !replaySigDenied,
    expected: "sigValid: true, replaySigDenied: false",
    actual: `sigValid: ${sigValid}, replaySigDenied: ${replaySigDenied}`,
  });

  // 7. TOOL MARKETPLACE VALIDATION & KILL SWITCH
  const killTest = toolMarketplace.setKillSwitch(
    "repo.ast_grep@1.2.0",
    true,
    "Emergency patch review"
  );
  const killCheck = toolMarketplace.isToolExecutable("repo.ast_grep", testTenant);

  // Restore
  toolMarketplace.setKillSwitch("repo.ast_grep@1.2.0", false, "Patched and verified");
  const restoreCheck = toolMarketplace.isToolExecutable("repo.ast_grep", testTenant);

  results.push({
    suite: "Tool Marketplace",
    name: "enforces immediate execution blocking upon kill switch activation",
    passed: !killCheck.allowed && restoreCheck.allowed,
    expected: "killed: allowed=false, restored: allowed=true",
    actual: `killed: ${killCheck.allowed}, restored: ${restoreCheck.allowed}`,
    details: killCheck.reason,
  });

  // 8. USAGE BILLING RECONCILIATION
  const invoice = billingEngine.reconcileInvoice(testTenant, "team");
  const reconZeroDiscrepancy =
    invoice.status === "reconciled" && invoice.discrepancyAmount === 0 && invoice.total > 0;

  results.push({
    suite: "Billing & Plans",
    name: "produces certified invoice with zero ledger discrepancy",
    passed: reconZeroDiscrepancy,
    expected: "status: reconciled with discrepancyAmount: 0.0",
    actual: `status: ${invoice.status}, total: $${invoice.total}, discrepancy: $${invoice.discrepancyAmount}`,
  });

  // 9. CHANGE GOVERNANCE TWO-PERSON RULE
  const highRiskChange = changeGovernance.proposeChange(
    "policy_engine",
    "Update Enterprise Network Egress Allowlist",
    "high",
    ["packages/policy/src/matrix.ts"],
    "Revert git commit and invalidate policy cache",
    "eng_alice"
  );

  let selfApprovalBlocked = false;
  try {
    changeGovernance.approveChange(highRiskChange.id, "eng_alice");
  } catch (err: any) {
    if (err.message.includes("TWO_PERSON_RULE_VIOLATION")) {
      selfApprovalBlocked = true;
    }
  }

  // Second distinct reviewer approves
  const validApproval = changeGovernance.approveChange(highRiskChange.id, "eng_bob_secops");

  results.push({
    suite: "Change Governance",
    name: "strictly enforces Two-Person Rule for high-risk policy modifications",
    passed: selfApprovalBlocked && validApproval.approvedBy.includes("eng_bob_secops"),
    expected: "Proposer self-approval denied, distinct reviewer accepted",
    actual: `selfApprovalBlocked: ${selfApprovalBlocked}, approvers: ${validApproval.approvedBy.length}`,
  });

  // 10. GA READINESS GATES
  const gaGatesPassed = GA_LAUNCH_GATES.every(
    (g) => g.securityReviewPassed && g.rollbackVerified && g.supportReady && g.maxOpenSev1 === 0
  );

  results.push({
    suite: "GA Launch Gates",
    name: "satisfies all zero-SEV1 and rollback safety requirements for GA",
    passed: gaGatesPassed,
    expected: "All 5 stages (GA-0 to GA-4) meet readiness criteria",
    actual: `GA gates passing: ${gaGatesPassed}`,
  });

  return results;
}
