/**
 * AI Workbench - Cost Anomaly Detection & Runaway Circuit Breaker
 * Sprint 12: Continuous Improvement & Governance 2.0
 */

import { auditLedger } from "../../audit/src/ledger";

export type CostAnomalyReason =
  | "retry_loop"
  | "large_context"
  | "model_escalation"
  | "sandbox_runtime"
  | "artifact_growth";

export interface CostAnomaly {
  id: string;
  tenantId: string;
  runId?: string;
  baselineCost: number;
  observedCost: number;
  deviationRatio: number;
  reason: CostAnomalyReason;
  alertTriggered: boolean;
  freezeEscalation: boolean;
  circuitBreakerTripped: boolean;
  timestamp: string;
  remediationSummary: string;
}

export interface CostOptimizationMetrics {
  totalTokensProcessed: number;
  cachedTokensRatio: number;     // Prompt caching efficiency (0..1)
  idleSandboxesReclaimed: number;
  unneededRetriesBlocked: number;
  estimatedSavingsUsd: number;
}

export class CostAnomalySentinel {
  private anomalies: CostAnomaly[] = [];
  private escalationFrozenTenants: Set<string> = new Set();
  private metrics: CostOptimizationMetrics = {
    totalTokensProcessed: 14_250_000,
    cachedTokensRatio: 0.68,
    idleSandboxesReclaimed: 342,
    unneededRetriesBlocked: 89,
    estimatedSavingsUsd: 1420.50,
  };

  constructor() {
    this.seedAnomalies();
  }

  private seedAnomalies() {
    this.anomalies = [
      {
        id: "anomaly_01",
        tenantId: "tenant_fintech_01",
        runId: "run_881a2",
        baselineCost: 0.20,
        observedCost: 1.45,
        deviationRatio: 7.25,
        reason: "retry_loop",
        alertTriggered: true,
        freezeEscalation: true,
        circuitBreakerTripped: true,
        timestamp: new Date(Date.now() - 3600_000 * 3).toISOString(),
        remediationSummary: "Halted 6th recursive compilation attempt. Circuit breaker tripped.",
      },
      {
        id: "anomaly_02",
        tenantId: "tenant_health_02",
        runId: "run_334c9",
        baselineCost: 0.15,
        observedCost: 0.98,
        deviationRatio: 6.53,
        reason: "large_context",
        alertTriggered: true,
        freezeEscalation: true,
        circuitBreakerTripped: true,
        timestamp: new Date(Date.now() - 3600_000).toISOString(),
        remediationSummary: "Input payload injected 400KB minified bundle without chunking. Context pruned.",
      },
    ];
  }

  public detectAnomaly(input: {
    tenantId: string;
    runId?: string;
    baselineCost: number;
    observedCost: number;
    reason: CostAnomalyReason;
    thresholdRatio?: number; // Defaults to 2.0 (200% of baseline)
  }): { anomalyDetected: boolean; anomaly?: CostAnomaly } {
    const threshold = input.thresholdRatio || 2.0;
    const deviationRatio = input.baselineCost > 0 ? input.observedCost / input.baselineCost : 1;

    if (deviationRatio >= threshold) {
      const anomaly: CostAnomaly = {
        id: `anomaly_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tenantId: input.tenantId,
        runId: input.runId,
        baselineCost: input.baselineCost,
        observedCost: input.observedCost,
        deviationRatio: Number(deviationRatio.toFixed(2)),
        reason: input.reason,
        alertTriggered: true,
        freezeEscalation: true,
        circuitBreakerTripped: true,
        timestamp: new Date().toISOString(),
        remediationSummary: `Runaway spend detected (${deviationRatio.toFixed(1)}x baseline). Automatic model escalation frozen.`,
      };

      this.anomalies.unshift(anomaly);
      this.escalationFrozenTenants.add(input.tenantId);
      this.metrics.unneededRetriesBlocked++;
      this.metrics.estimatedSavingsUsd += input.observedCost - input.baselineCost;

      auditLedger.record({
        tenantId: input.tenantId,
        runId: input.runId,
        eventType: "COST_ANOMALY_CIRCUIT_BREAKER_TRIPPED",
        actorId: "cost_sentinel",
        actorType: "system",
        details: {
          deviationRatio,
          reason: input.reason,
          baselineCost: input.baselineCost,
          observedCost: input.observedCost,
        },
      });

      return { anomalyDetected: true, anomaly };
    }

    return { anomalyDetected: false };
  }

  public isEscalationFrozen(tenantId: string): boolean {
    return this.escalationFrozenTenants.has(tenantId);
  }

  public unfreezeEscalation(tenantId: string, reviewerId: string): void {
    this.escalationFrozenTenants.delete(tenantId);
    auditLedger.record({
      tenantId,
      eventType: "COST_ESCALATION_UNFROZEN",
      actorId: reviewerId,
      actorType: "user",
      details: { reviewerId },
    });
  }

  public getAnomalies(tenantId?: string): CostAnomaly[] {
    if (tenantId) {
      return this.anomalies.filter((a) => a.tenantId === tenantId);
    }
    return [...this.anomalies];
  }

  public getOptimizationMetrics(): CostOptimizationMetrics {
    return { ...this.metrics };
  }
}

export const costAnomalySentinel = new CostAnomalySentinel();
