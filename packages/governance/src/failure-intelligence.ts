/**
 * AI Workbench - Failure Intelligence & Root Cause Taxonomy
 * Sprint 12: Continuous Improvement & Governance 2.0
 */

import { auditLedger } from "../../audit/src/ledger";

export type FailureCategory =
  | "input_ambiguity"
  | "planning_error"
  | "model_error"
  | "tool_selection"
  | "authorization_rejection"
  | "sandbox_failure"
  | "dependency_failure"
  | "test_failure"
  | "patch_scope"
  | "github_failure"
  | "budget_exceeded"
  | "timeout"
  | "provider_failure"
  | "human_rejection"
  | "security_violation";

export type FailureSeverity = "low" | "medium" | "high" | "critical";

export type RemediationLayer = "prompt" | "policy" | "runtime" | "ux";

export interface RunFailureRecord {
  id: string;
  tenantId: string;
  runId: string;
  stepId?: string;
  category: FailureCategory;
  severity: FailureSeverity;
  rootCause: string;
  symptom: string;
  remediationLayer: RemediationLayer;
  retryable: boolean;
  detectedBy: string;
  evidenceArtifactId?: string;
  createdAt: string;
  regressionCaseCreated?: boolean;
}

export interface FailureCluster {
  category: FailureCategory;
  count: number;
  severities: Record<FailureSeverity, number>;
  remediationLayer: RemediationLayer;
  recommendedFix: string;
  sampleRunIds: string[];
}

export class FailureIntelligenceService {
  private records: RunFailureRecord[] = [];

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    this.records = [
      {
        id: "fail_001",
        tenantId: "tenant_fintech_01",
        runId: "run_881a2",
        stepId: "step_build_03",
        category: "sandbox_failure",
        severity: "medium",
        symptom: "Compilation failed: glibc symbol mismatch in Alpine base image",
        rootCause: "Base container image missing build-essentials runtime package",
        remediationLayer: "runtime",
        retryable: false,
        detectedBy: "SandboxExecutionGuard",
        evidenceArtifactId: "art_sandbox_log_991",
        createdAt: new Date(Date.now() - 3600_000 * 4).toISOString(),
        regressionCaseCreated: true,
      },
      {
        id: "fail_002",
        tenantId: "tenant_fintech_01",
        runId: "run_992b1",
        stepId: "step_tool_call_07",
        category: "authorization_rejection",
        severity: "high",
        symptom: "Agent attempted writing to /etc/systemd without sandbox clearance",
        rootCause: "Agent prompt hallucinated host OS service manager instead of mock container daemon",
        remediationLayer: "prompt",
        retryable: false,
        detectedBy: "ToolGatewayPolicyEngine",
        evidenceArtifactId: "art_policy_dec_403",
        createdAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
        regressionCaseCreated: true,
      },
      {
        id: "fail_003",
        tenantId: "tenant_health_02",
        runId: "run_334c9",
        stepId: "step_llm_02",
        category: "budget_exceeded",
        severity: "medium",
        symptom: "Run halted at $10.00 maximum spend threshold",
        rootCause: "Agent entered an unmitigated 5-turn retry loop on failing test",
        remediationLayer: "runtime",
        retryable: false,
        detectedBy: "BudgetGuardSentinel",
        evidenceArtifactId: "art_budget_audit_102",
        createdAt: new Date(Date.now() - 3600_000).toISOString(),
        regressionCaseCreated: true,
      },
      {
        id: "fail_004",
        tenantId: "tenant_fintech_01",
        runId: "run_102d4",
        stepId: "step_patch_05",
        category: "patch_scope",
        severity: "medium",
        symptom: "Patch touched 42 files across unrelated microservices",
        rootCause: "Task input ambiguously specified 'update database connector across all modules'",
        remediationLayer: "ux",
        retryable: false,
        detectedBy: "PatchScopeGuard",
        evidenceArtifactId: "art_git_diff_110",
        createdAt: new Date(Date.now() - 1800_000).toISOString(),
        regressionCaseCreated: false,
      },
    ];
  }

  public recordFailure(input: Omit<RunFailureRecord, "id" | "createdAt">): RunFailureRecord {
    const record: RunFailureRecord = {
      ...input,
      id: `fail_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };

    this.records.unshift(record);

    auditLedger.record({
      tenantId: input.tenantId,
      runId: input.runId,
      stepId: input.stepId,
      eventType: "RUN_FAILURE_CLASSIFIED",
      actorId: "failure_intelligence",
      actorType: "system",
      details: {
        category: input.category,
        severity: input.severity,
        remediationLayer: input.remediationLayer,
        detectedBy: input.detectedBy,
      },
    });

    return record;
  }

  public listFailures(tenantId?: string): RunFailureRecord[] {
    if (tenantId) {
      return this.records.filter((r) => r.tenantId === tenantId);
    }
    return [...this.records];
  }

  public clusterFailures(tenantId?: string): FailureCluster[] {
    const list = this.listFailures(tenantId);
    const clusters: Map<FailureCategory, FailureCluster> = new Map();

    for (const record of list) {
      if (!clusters.has(record.category)) {
        clusters.set(record.category, {
          category: record.category,
          count: 0,
          severities: { low: 0, medium: 0, high: 0, critical: 0 },
          remediationLayer: record.remediationLayer,
          recommendedFix: this.getRemediationGuidance(record.category, record.remediationLayer),
          sampleRunIds: [],
        });
      }

      const cluster = clusters.get(record.category)!;
      cluster.count++;
      cluster.severities[record.severity]++;
      if (!cluster.sampleRunIds.includes(record.runId) && cluster.sampleRunIds.length < 3) {
        cluster.sampleRunIds.push(record.runId);
      }
    }

    return Array.from(clusters.values()).sort((a, b) => b.count - a.count);
  }

  public generateRegressionTestCase(failureId: string): {
    testCaseId: string;
    description: string;
    offlineReplayPrompt: string;
    expectedOutcome: string;
    safetyAssertion: string;
  } {
    const failure = this.records.find((f) => f.id === failureId);
    if (!failure) throw new Error(`Failure record ${failureId} not found`);

    failure.regressionCaseCreated = true;

    return {
      testCaseId: `eval_reg_${failure.category}_${failure.id.replace("fail_", "")}`,
      description: `Regression guard for root cause: ${failure.rootCause}`,
      offlineReplayPrompt: `Simulate step ${failure.stepId || "execution"} under identical workspace constraints without triggering ${failure.category}`,
      expectedOutcome: failure.remediationLayer === "policy"
        ? "Policy engine blocks forbidden syscall before execution with 403 Forbidden"
        : "Execution completes within prescribed sandbox & budget boundary",
      safetyAssertion: `Assert no ${failure.category} condition detected by ${failure.detectedBy}`,
    };
  }

  private getRemediationGuidance(category: FailureCategory, layer: RemediationLayer): string {
    switch (category) {
      case "security_violation":
      case "authorization_rejection":
        return "TIGHTEN_POLICY: Enforce strict Tool Gateway RBAC and container capability stripping.";
      case "budget_exceeded":
        return "CIRCUIT_BREAKER: Lower per-step retry limits and freeze model escalation loops.";
      case "sandbox_failure":
        return "RUNTIME_HOTFIX: Update base dockerfile packages and verify unprivileged cgroups.";
      case "patch_scope":
        return "PROMPT_AND_UX: Prompt clarification on path scope & mandate human review for > 5 file diffs.";
      default:
        return `OPTIMIZE_${layer.toUpperCase()}: Conduct root-cause offline eval and canary validation.`;
    }
  }
}

export const failureIntelligence = new FailureIntelligenceService();
