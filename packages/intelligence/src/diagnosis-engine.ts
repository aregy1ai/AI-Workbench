/**
 * AI Workbench - Automated Failure Diagnosis Engine
 * Sprint 13: Platform Intelligence & Autonomous Operations
 */

import { RiskLevel } from "../../policy/src/risk-adaptive";
import { auditLedger } from "../../audit/src/ledger";

export interface DiagnosticTelemetry {
  runId: string;
  tenantId: string;
  stepId?: string;
  providerError?: string;
  sandboxExitCode?: number;
  sandboxErrorOutput?: string;
  queueLatencyMs?: number;
  policyDecisionCode?: string;
  runStatus: string;
}

export type RecommendedActionType =
  | "retry_step"
  | "switch_provider"
  | "drain_worker"
  | "pause_tenant"
  | "rollback_release"
  | "open_incident";

export interface RecommendedAction {
  id: string;
  actionType: RecommendedActionType;
  risk: RiskLevel;
  estimatedImpact: string;
  requiresApproval: boolean;
  autoExecutable: boolean;
  targetEntityId: string;
}

export interface DiagnosisResult {
  incidentId: string;
  probableCause: string;
  confidence: number; // 0.0 - 1.0
  affectedComponents: string[];
  affectedTenants: string[];
  recommendedActions: RecommendedAction[];
  evidenceArtifactIds: string[];
  diagnosedAt: string;
}

export class FailureDiagnosisEngine {
  private history: DiagnosisResult[] = [];

  constructor() {
    this.seedInitialDiagnoses();
  }

  private seedInitialDiagnoses() {
    this.history = [
      {
        incidentId: "diag_inc_8801",
        probableCause: "Container Memory Exhaustion (cgroups OOM Killer Triggered)",
        confidence: 0.98,
        affectedComponents: ["sandbox_scheduler", "worker_node_eu_02"],
        affectedTenants: ["tenant_fintech_01"],
        recommendedActions: [
          {
            id: "act_rec_01",
            actionType: "drain_worker",
            risk: "medium",
            estimatedImpact: "Recycle exhausted container pool node without customer run interruption",
            requiresApproval: false,
            autoExecutable: true,
            targetEntityId: "worker_node_eu_02",
          },
          {
            id: "act_rec_02",
            actionType: "retry_step",
            risk: "low",
            estimatedImpact: "Re-execute failed build with 4GB dynamic cgroups memory ceiling",
            requiresApproval: false,
            autoExecutable: true,
            targetEntityId: "run_881a2",
          },
        ],
        evidenceArtifactIds: ["art_kernel_dmesg_oom_881"],
        diagnosedAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
      },
      {
        incidentId: "diag_inc_8802",
        probableCause: "Upstream LLM Provider HTTP 429 (Rate Limit Breached on Secondary Account)",
        confidence: 0.94,
        affectedComponents: ["model_gateway", "provider_client"],
        affectedTenants: ["tenant_health_02"],
        recommendedActions: [
          {
            id: "act_rec_03",
            actionType: "switch_provider",
            risk: "medium",
            estimatedImpact: "Direct queued requests to tertiary verified enterprise provider pool",
            requiresApproval: false,
            autoExecutable: true,
            targetEntityId: "provider_gemini_primary",
          },
        ],
        evidenceArtifactIds: ["art_provider_headers_429"],
        diagnosedAt: new Date(Date.now() - 3600_000).toISOString(),
      },
    ];
  }

  /**
   * Evaluates telemetry signals and determines probable root cause with actionable recommendations
   */
  public diagnose(telemetry: DiagnosticTelemetry): DiagnosisResult {
    const actions: RecommendedAction[] = [];
    let probableCause = "Unspecified Execution Fault";
    let confidence = 0.5;
    const components: string[] = ["execution_plane"];

    // Scenario 1: cgroups OOM
    if (telemetry.sandboxExitCode === 137 || telemetry.sandboxErrorOutput?.includes("Killed")) {
      probableCause = "Sandbox Container Memory Cap Exceeded (cgroups OOM 137)";
      confidence = 0.98;
      components.push("sandbox_scheduler", "cgroups_controller");

      actions.push({
        id: `act_${Date.now()}_drain`,
        actionType: "drain_worker",
        risk: "low",
        estimatedImpact: "Safely isolate worker node and recycle memory pool",
        requiresApproval: false,
        autoExecutable: true,
        targetEntityId: telemetry.runId,
      });

      actions.push({
        id: `act_${Date.now()}_retry`,
        actionType: "retry_step",
        risk: "low",
        estimatedImpact: "Idempotently reschedule run step with expanded memory limits",
        requiresApproval: false,
        autoExecutable: true,
        targetEntityId: telemetry.runId,
      });
    }
    // Scenario 2: Provider Rate Limit or Gateway 5xx
    else if (
      telemetry.providerError?.includes("429") ||
      telemetry.providerError?.includes("RESOURCE_EXHAUSTED") ||
      telemetry.providerError?.includes("503")
    ) {
      probableCause = "Upstream Provider Capacity Throttling / Rate Limit Breached";
      confidence = 0.95;
      components.push("model_gateway", "upstream_llm");

      actions.push({
        id: `act_${Date.now()}_switch`,
        actionType: "switch_provider",
        risk: "medium",
        estimatedImpact: "Transparently failover to fallback model endpoint with zero token loss",
        requiresApproval: false,
        autoExecutable: true,
        targetEntityId: "model_router",
      });
    }
    // Scenario 3: Policy / Security Boundary Rejection
    else if (telemetry.policyDecisionCode?.includes("FORBIDDEN") || telemetry.policyDecisionCode?.includes("REJECTED")) {
      probableCause = "Agent Kernel Syscall Violation or Host Path Escalation Attempt";
      confidence = 0.96;
      components.push("tool_gateway", "seccomp_filter");

      actions.push({
        id: `act_${Date.now()}_incident`,
        actionType: "open_incident",
        risk: "high",
        estimatedImpact: "Halt run immediately and notify security operations team",
        requiresApproval: true,
        autoExecutable: false,
        targetEntityId: telemetry.runId,
      });

      actions.push({
        id: `act_${Date.now()}_pause`,
        actionType: "pause_tenant",
        risk: "critical",
        estimatedImpact: "Temporarily pause automated execution for tenant pending review",
        requiresApproval: true,
        autoExecutable: false,
        targetEntityId: telemetry.tenantId,
      });
    }
    // Scenario 4: Timeout
    else if (telemetry.sandboxExitCode === 124 || (telemetry.queueLatencyMs && telemetry.queueLatencyMs > 60000)) {
      probableCause = "Execution Duration Exceeded Hard Sandbox Wall-Clock Timeout (124)";
      confidence = 0.89;
      components.push("job_queue", "runner");

      actions.push({
        id: `act_${Date.now()}_retry_timeout`,
        actionType: "retry_step",
        risk: "low",
        estimatedImpact: "Retry step with warm container cache if confirmed idempotent",
        requiresApproval: false,
        autoExecutable: true,
        targetEntityId: telemetry.runId,
      });
    }

    const diagnosis: DiagnosisResult = {
      incidentId: `diag_inc_${Date.now().toString(36)}`,
      probableCause,
      confidence,
      affectedComponents: components,
      affectedTenants: [telemetry.tenantId],
      recommendedActions: actions,
      evidenceArtifactIds: [`art_trace_${telemetry.runId}`],
      diagnosedAt: new Date().toISOString(),
    };

    this.history.unshift(diagnosis);

    auditLedger.record({
      tenantId: telemetry.tenantId,
      runId: telemetry.runId,
      eventType: "DIAGNOSIS_ENGINE_COMPLETED",
      actorId: "diagnosis_engine",
      actorType: "system",
      details: {
        probableCause,
        confidence,
        actionsCount: actions.length,
      },
    });

    return diagnosis;
  }

  public getDiagnoses(tenantId?: string): DiagnosisResult[] {
    if (tenantId) {
      return this.history.filter((d) => d.affectedTenants.includes(tenantId));
    }
    return [...this.history];
  }
}

export const failureDiagnosisEngine = new FailureDiagnosisEngine();
