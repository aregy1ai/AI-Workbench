/**
 * AI Workbench - Automated Run Recovery & Idempotent Resumption
 * Sprint 13: Platform Intelligence & Autonomous Operations
 */

import { auditLedger } from "../../audit/src/ledger";

export type FailureTrigger =
  | "worker_heartbeat_lost"
  | "provider_timeout"
  | "sandbox_cold_start_timeout"
  | "github_api_transient_502"
  | "sse_disconnect"
  | "policy_denial"
  | "secret_detected"
  | "cross_tenant_suspicion"
  | "duplicate_external_effect"
  | "budget_exceeded"
  | "patch_scope_violation"
  | "sandbox_escape_suspicion";

export interface RecoveryAssessment {
  runId: string;
  tenantId: string;
  trigger: FailureTrigger;
  isAutoRecoverable: boolean;
  requiresIncidentTicket: boolean;
  idempotencyVerified: boolean;
  resolutionStrategy: "auto_resume_idempotent" | "open_security_incident" | "quarantine_run";
  reason: string;
  assessedAt: string;
}

export class AutomatedRunRecoveryService {
  private recoveryLogs: RecoveryAssessment[] = [];

  /**
   * Assesses whether a failed or stalled run can be safely resumed autonomously
   */
  public assessAndRecover(
    runId: string,
    tenantId: string,
    trigger: FailureTrigger,
    hasIdempotencyKey: boolean = true
  ): RecoveryAssessment {
    // Non-recoverable security and business invariant triggers
    const nonRecoverableTriggers: FailureTrigger[] = [
      "policy_denial",
      "secret_detected",
      "cross_tenant_suspicion",
      "duplicate_external_effect",
      "budget_exceeded",
      "patch_scope_violation",
      "sandbox_escape_suspicion",
    ];

    if (nonRecoverableTriggers.includes(trigger)) {
      const assessment: RecoveryAssessment = {
        runId,
        tenantId,
        trigger,
        isAutoRecoverable: false,
        requiresIncidentTicket: true,
        idempotencyVerified: false,
        resolutionStrategy: "open_security_incident",
        reason: `SECURITY_OR_INVARIANT_VIOLATION: Trigger '${trigger}' cannot be retried automatically. Flagged for human review.`,
        assessedAt: new Date().toISOString(),
      };

      this.recoveryLogs.unshift(assessment);

      auditLedger.record({
        tenantId,
        runId,
        eventType: "RUN_RECOVERY_BLOCKED_INCIDENT_OPENED",
        actorId: "recovery_service",
        actorType: "system",
        details: { trigger, strategy: assessment.resolutionStrategy },
      });

      return assessment;
    }

    // Auto-recoverable transient triggers
    if (!hasIdempotencyKey) {
      const assessment: RecoveryAssessment = {
        runId,
        tenantId,
        trigger,
        isAutoRecoverable: false,
        requiresIncidentTicket: true,
        idempotencyVerified: false,
        resolutionStrategy: "quarantine_run",
        reason: `MISSING_IDEMPOTENCY_KEY: Cannot safely retry '${trigger}' without guaranteed non-duplication token.`,
        assessedAt: new Date().toISOString(),
      };
      this.recoveryLogs.unshift(assessment);
      return assessment;
    }

    const assessment: RecoveryAssessment = {
      runId,
      tenantId,
      trigger,
      isAutoRecoverable: true,
      requiresIncidentTicket: false,
      idempotencyVerified: true,
      resolutionStrategy: "auto_resume_idempotent",
      reason: `TRANSIENT_FAULT_RECOVERABLE: Trigger '${trigger}' is safe to resume with verified idempotency barrier.`,
      assessedAt: new Date().toISOString(),
    };

    this.recoveryLogs.unshift(assessment);

    auditLedger.record({
      tenantId,
      runId,
      eventType: "RUN_AUTO_RECOVERY_AUTHORIZED",
      actorId: "recovery_service",
      actorType: "system",
      details: { trigger, strategy: assessment.resolutionStrategy },
    });

    return assessment;
  }

  public getLogs(): RecoveryAssessment[] {
    return [...this.recoveryLogs];
  }
}

export const automatedRunRecoveryService = new AutomatedRunRecoveryService();
