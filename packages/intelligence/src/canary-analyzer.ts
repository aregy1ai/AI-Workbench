/**
 * AI Workbench - Automated Canary Analysis & Progressive Rollout
 * Sprint 13: Platform Intelligence & Autonomous Operations
 */

import { auditLedger } from "../../audit/src/ledger";

export interface CanaryMetrics {
  errorRate: number;           // 0..1
  p95LatencyMs: number;
  firstTokenLatencyMs: number;
  patchAcceptanceRate: number; // 0..1
  testsPassRate: number;       // 0..1
  securityRejections: number;  // Must be 0
  fallbackRate: number;        // 0..1
  costPerRunUsd: number;
  duplicateExternalActions: number; // Must be 0
}

export type CanaryDecisionType = "advance" | "hold" | "rollback";

export interface CanaryDecision {
  releaseId: string;
  currentTrafficWeight: number; // e.g. 1%, 5%, 10%
  nextTrafficWeight: number;
  baselineWindow: string;
  candidateWindow: string;
  decision: CanaryDecisionType;
  reasons: string[];
  confidence: number;
  metricsComparison: {
    candidateErrorRate: number;
    baselineErrorRate: number;
    candidateP95Ms: number;
    baselineP95Ms: number;
    securityRejections: number;
    duplicateExternalActions: number;
  };
  evaluatedAt: string;
}

export class AutomatedCanaryAnalyzer {
  private baselineMetrics: CanaryMetrics = {
    errorRate: 0.015,
    p95LatencyMs: 2400,
    firstTokenLatencyMs: 380,
    patchAcceptanceRate: 0.94,
    testsPassRate: 0.98,
    securityRejections: 0,
    fallbackRate: 0.02,
    costPerRunUsd: 0.18,
    duplicateExternalActions: 0,
  };

  private history: CanaryDecision[] = [];

  /**
   * Evaluates candidate canary slice against baseline SLA
   */
  public evaluateCanary(
    releaseId: string,
    currentTrafficWeight: number,
    candidateMetrics: CanaryMetrics
  ): CanaryDecision {
    const reasons: string[] = [];
    let decision: CanaryDecisionType = "advance";
    let nextTrafficWeight = currentTrafficWeight;

    // Hard Rule 1: Zero security violations tolerance
    if (candidateMetrics.securityRejections > 0) {
      decision = "rollback";
      reasons.push(
        `CRITICAL_SECURITY_BREACH: Canary generated ${candidateMetrics.securityRejections} security rejections. Immediate rollback enforced.`
      );
    }

    // Hard Rule 2: Zero duplicate external actions
    if (candidateMetrics.duplicateExternalActions > 0) {
      decision = "rollback";
      reasons.push(
        `DUPLICATE_EXTERNAL_ACTIONS: Canary produced ${candidateMetrics.duplicateExternalActions} non-idempotent side effects.`
      );
    }

    // Performance Rule 3: Error rate regression
    if (candidateMetrics.errorRate > this.baselineMetrics.errorRate * 1.5) {
      decision = "rollback";
      reasons.push(
        `ERROR_RATE_SPIKE: Canary error rate ${(candidateMetrics.errorRate * 100).toFixed(1)}% is over 1.5x baseline (${(this.baselineMetrics.errorRate * 100).toFixed(1)}%)`
      );
    }

    // Quality Rule 4: Test pass degradation
    if (candidateMetrics.testsPassRate < 0.95) {
      decision = "rollback";
      reasons.push(
        `TEST_PASS_DEGRADATION: Canary test pass rate ${(candidateMetrics.testsPassRate * 100).toFixed(1)}% dropped below required 95%`
      );
    }

    // Latency degradation
    if (candidateMetrics.p95LatencyMs > this.baselineMetrics.p95LatencyMs * 1.4 && decision !== "rollback") {
      decision = "hold";
      reasons.push(
        `LATENCY_SLA_WARNING: p95 latency ${candidateMetrics.p95LatencyMs}ms is elevated. Holding at ${currentTrafficWeight}% traffic.`
      );
    }

    // Progression logic
    if (decision === "advance") {
      if (currentTrafficWeight === 1) nextTrafficWeight = 5;
      else if (currentTrafficWeight === 5) nextTrafficWeight = 10;
      else if (currentTrafficWeight >= 10) nextTrafficWeight = 100; // Full GA release
      reasons.push(`METRICS_COMPLIANT: SLA margins satisfied. Advancing traffic to ${nextTrafficWeight}%`);
    } else if (decision === "rollback") {
      nextTrafficWeight = 0;
    }

    const result: CanaryDecision = {
      releaseId,
      currentTrafficWeight,
      nextTrafficWeight,
      baselineWindow: "last_24h_prod",
      candidateWindow: "canary_current_window",
      decision,
      reasons,
      confidence: 0.96,
      metricsComparison: {
        candidateErrorRate: candidateMetrics.errorRate,
        baselineErrorRate: this.baselineMetrics.errorRate,
        candidateP95Ms: candidateMetrics.p95LatencyMs,
        baselineP95Ms: this.baselineMetrics.p95LatencyMs,
        securityRejections: candidateMetrics.securityRejections,
        duplicateExternalActions: candidateMetrics.duplicateExternalActions,
      },
      evaluatedAt: new Date().toISOString(),
    };

    this.history.unshift(result);

    auditLedger.record({
      tenantId: "system_deployment",
      eventType: `CANARY_ANALYSIS_${decision.toUpperCase()}`,
      actorId: "canary_analyzer",
      actorType: "system",
      details: {
        releaseId,
        decision,
        currentTraffic: currentTrafficWeight,
        nextTraffic: nextTrafficWeight,
      },
    });

    return result;
  }

  public getHistory(): CanaryDecision[] {
    return [...this.history];
  }
}

export const automatedCanaryAnalyzer = new AutomatedCanaryAnalyzer();
