/**
 * AI Workbench - Autonomous Operations Action Classification & Safety Tiers
 * Sprint 13: Platform Intelligence & Autonomous Operations
 */

import { RiskLevel } from "../../policy/src/risk-adaptive";

export type AutomationClass =
  | "observe_only"
  | "recommend"
  | "auto_safe"
  | "approval_required"
  | "prohibited";

export interface ActionDefinition {
  id: string;
  name: string;
  category: "infrastructure" | "runtime" | "policy" | "data" | "deployment";
  automationClass: AutomationClass;
  riskLevel: RiskLevel;
  isIdempotent: boolean;
  maxExecutionTimeMs: number;
  description: string;
}

export const ACTION_CATALOG: ActionDefinition[] = [
  // Observe Only
  {
    id: "act_annotate_dashboard",
    name: "Create Dashboard Annotation",
    category: "infrastructure",
    automationClass: "observe_only",
    riskLevel: "low",
    isIdempotent: true,
    maxExecutionTimeMs: 1000,
    description: "Publish non-intrusive annotation marking anomaly spike or model switch",
  },
  {
    id: "act_aggregate_traces",
    name: "Aggregate Diagnostic Traces",
    category: "runtime",
    automationClass: "observe_only",
    riskLevel: "low",
    isIdempotent: true,
    maxExecutionTimeMs: 3000,
    description: "Compile and cluster distributed spans for failed runs without side effects",
  },

  // Auto Safe (Low Risk, Guaranteed Reversible or Idempotent)
  {
    id: "act_retry_idempotent_step",
    name: "Retry Idempotent Step",
    category: "runtime",
    automationClass: "auto_safe",
    riskLevel: "low",
    isIdempotent: true,
    maxExecutionTimeMs: 5000,
    description: "Re-execute transiently failed read/lint step with identical nonce",
  },
  {
    id: "act_reduce_sampling_rate",
    name: "Temporarily Lower Trace Sampling",
    category: "infrastructure",
    automationClass: "auto_safe",
    riskLevel: "low",
    isIdempotent: true,
    maxExecutionTimeMs: 1000,
    description: "Shed load during telemetry saturation from 100% to 20% for successful runs",
  },
  {
    id: "act_rotate_idle_worker",
    name: "Recycle Idle Worker Container",
    category: "infrastructure",
    automationClass: "auto_safe",
    riskLevel: "low",
    isIdempotent: true,
    maxExecutionTimeMs: 4000,
    description: "Terminate stale worker node exceeding 30-minute idle threshold",
  },
  {
    id: "act_prewarm_sandbox_pool",
    name: "Pre-warm Standby Sandboxes",
    category: "infrastructure",
    automationClass: "auto_safe",
    riskLevel: "low",
    isIdempotent: true,
    maxExecutionTimeMs: 8000,
    description: "Spin up unassigned cgroups-isolated sandbox slots ahead of forecasted spike",
  },

  // Approval Required (Touches Routing, Quotas, or Tenant Boundaries)
  {
    id: "act_adjust_model_routing",
    name: "Modify Production Model Routing",
    category: "runtime",
    automationClass: "approval_required",
    riskLevel: "high",
    isIdempotent: true,
    maxExecutionTimeMs: 2000,
    description: "Shift traffic split between baseline and canary models",
  },
  {
    id: "act_increase_tenant_quota",
    name: "Expand Tenant Budget / Concurrency Quota",
    category: "policy",
    automationClass: "approval_required",
    riskLevel: "high",
    isIdempotent: true,
    maxExecutionTimeMs: 2000,
    description: "Increase hourly spend limit or max parallel run concurrency",
  },
  {
    id: "act_modify_security_policy",
    name: "Update Tool Gateway Security Policy",
    category: "policy",
    automationClass: "approval_required",
    riskLevel: "critical",
    isIdempotent: false,
    maxExecutionTimeMs: 2000,
    description: "Alter allowed syscalls, network allowlists, or role bindings",
  },
  {
    id: "act_cross_region_failover",
    name: "Initiate Regional Tenant Failover",
    category: "infrastructure",
    automationClass: "approval_required",
    riskLevel: "critical",
    isIdempotent: false,
    maxExecutionTimeMs: 30000,
    description: "Migrate active tenant queue to secondary cloud region",
  },

  // Strictly Prohibited (Hard Invariants)
  {
    id: "act_disable_rls",
    name: "Disable PostgreSQL Row-Level Security",
    category: "data",
    automationClass: "prohibited",
    riskLevel: "critical",
    isIdempotent: false,
    maxExecutionTimeMs: 0,
    description: "Bypass tenant isolation barriers in persistent database (STRICTLY FORBIDDEN)",
  },
  {
    id: "act_reveal_secret",
    name: "Expose Decrypted Workload Credential",
    category: "data",
    automationClass: "prohibited",
    riskLevel: "critical",
    isIdempotent: false,
    maxExecutionTimeMs: 0,
    description: "Print raw API keys, private keys, or SSH credentials into logs (STRICTLY FORBIDDEN)",
  },
  {
    id: "act_unapproved_prod_merge",
    name: "Merge to Main or Deploy Production Without Sign-off",
    category: "deployment",
    automationClass: "prohibited",
    riskLevel: "critical",
    isIdempotent: false,
    maxExecutionTimeMs: 0,
    description: "Unsupervised push to production environment (STRICTLY FORBIDDEN)",
  },
  {
    id: "act_purge_audit_evidence",
    name: "Delete Immutable Audit Evidence Chain",
    category: "data",
    automationClass: "prohibited",
    riskLevel: "critical",
    isIdempotent: false,
    maxExecutionTimeMs: 0,
    description: "Truncate or tamper with Merkle hash-chained ledger events (STRICTLY FORBIDDEN)",
  },
];

export function getActionDefinition(actionId: string): ActionDefinition {
  const match = ACTION_CATALOG.find((a) => a.id === actionId);
  if (!match) {
    throw new Error(`Action '${actionId}' is not registered in autonomous action catalog`);
  }
  return match;
}

export function validateActionSafety(actionId: string): {
  isAllowed: boolean;
  requiresHumanReview: boolean;
  isProhibited: boolean;
  reason: string;
} {
  const action = getActionDefinition(actionId);

  if (action.automationClass === "prohibited") {
    return {
      isAllowed: false,
      requiresHumanReview: false,
      isProhibited: true,
      reason: `SECURITY_INVARIANT_VIOLATION: Action '${action.name}' is strictly prohibited by platform control-plane rules.`,
    };
  }

  if (action.automationClass === "approval_required") {
    return {
      isAllowed: true,
      requiresHumanReview: true,
      isProhibited: false,
      reason: `HIGH_IMPACT_ACTION: Action '${action.name}' requires explicit human reviewer approval before execution.`,
    };
  }

  return {
    isAllowed: true,
    requiresHumanReview: false,
    isProhibited: false,
    reason: `AUTO_SAFE: Action '${action.name}' verified as non-destructive and idempotent. Auto-execution authorized.`,
  };
}
