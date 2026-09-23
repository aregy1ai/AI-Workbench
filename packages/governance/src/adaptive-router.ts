/**
 * AI Workbench - Adaptive Model Routing & Guarded Optimization
 * Sprint 12: Continuous Improvement & Governance 2.0
 */

import { auditLedger } from "../../audit/src/ledger";

export interface RoutingMetrics {
  qualityScore: number;          // 0..1 (Patch accuracy and correctness)
  successRate: number;           // 0..1 (Task completion rate)
  p95LatencyMs: number;          // Milliseconds
  costPerRun: number;            // Average USD cost per run
  fallbackRate: number;          // 0..1 (Rate of falling back to primary/secondary)
  securityRejectionRate: number; // 0..1 (Tool gateway policy rejections)
}

export type RoutingStage =
  | "offline_ranking"
  | "shadow_evaluation"
  | "canary_traffic"
  | "guarded_adaptation"
  | "approved_release";

export interface ModelRouteProfile {
  modelId: string;
  provider: string;
  stage: RoutingStage;
  trafficWeight: number; // 0 to 100 percentage
  metrics: RoutingMetrics;
  score: number;
  isBaseline: boolean;
  rollbackTriggered?: boolean;
  rollbackReason?: string;
}

export function latencyScore(latencyMs: number): number {
  if (latencyMs <= 1000) return 1.0;
  if (latencyMs >= 10000) return 0.0;
  return Math.max(0, Math.min(1, 1 - (latencyMs - 1000) / 9000));
}

export function costScore(costUsd: number): number {
  if (costUsd <= 0.05) return 1.0;
  if (costUsd >= 1.0) return 0.0;
  return Math.max(0, Math.min(1, 1 - (costUsd - 0.05) / 0.95));
}

export function routeScore(metrics: RoutingMetrics): number {
  return (
    metrics.qualityScore * 0.45 +
    metrics.successRate * 0.25 +
    latencyScore(metrics.p95LatencyMs) * 0.10 +
    costScore(metrics.costPerRun) * 0.10 -
    metrics.fallbackRate * 0.05 -
    metrics.securityRejectionRate * 0.05
  );
}

export class AdaptiveModelRouter {
  private profiles: Map<string, ModelRouteProfile> = new Map();

  constructor() {
    this.seedProfiles();
  }

  private seedProfiles() {
    const baselineMetrics: RoutingMetrics = {
      qualityScore: 0.95,
      successRate: 0.94,
      p95LatencyMs: 3200,
      costPerRun: 0.32,
      fallbackRate: 0.02,
      securityRejectionRate: 0.005,
    };

    const fastCandidateMetrics: RoutingMetrics = {
      qualityScore: 0.93,
      successRate: 0.92,
      p95LatencyMs: 1400,
      costPerRun: 0.09,
      fallbackRate: 0.03,
      securityRejectionRate: 0.006,
    };

    const riskyCandidateMetrics: RoutingMetrics = {
      qualityScore: 0.76,
      successRate: 0.78,
      p95LatencyMs: 950,
      costPerRun: 0.03,
      fallbackRate: 0.15,
      securityRejectionRate: 0.08, // Excessive security rejections
    };

    this.profiles.set("gemini-2.5-pro", {
      modelId: "gemini-2.5-pro",
      provider: "google",
      stage: "approved_release",
      trafficWeight: 80,
      metrics: baselineMetrics,
      score: routeScore(baselineMetrics),
      isBaseline: true,
    });

    this.profiles.set("gemini-2.5-flash", {
      modelId: "gemini-2.5-flash",
      provider: "google",
      stage: "canary_traffic",
      trafficWeight: 20,
      metrics: fastCandidateMetrics,
      score: routeScore(fastCandidateMetrics),
      isBaseline: false,
    });

    this.profiles.set("experimental-budget-llm", {
      modelId: "experimental-budget-llm",
      provider: "open-source-finetune",
      stage: "shadow_evaluation",
      trafficWeight: 0,
      metrics: riskyCandidateMetrics,
      score: routeScore(riskyCandidateMetrics),
      isBaseline: false,
    });
  }

  public getProfiles(): ModelRouteProfile[] {
    return Array.from(this.profiles.values());
  }

  public getBaseline(): ModelRouteProfile {
    const base = Array.from(this.profiles.values()).find((p) => p.isBaseline);
    if (!base) {
      throw new Error("No baseline model route found");
    }
    return base;
  }

  /**
   * Evaluates if a model can advance to the next routing stage
   * Hard constraint: Cannot optimize cost/latency at the expense of security or patch quality
   */
  public evaluateStagePromotion(modelId: string): {
    promoted: boolean;
    reason: string;
    nextStage?: RoutingStage;
  } {
    const candidate = this.profiles.get(modelId);
    if (!candidate) throw new Error(`Model profile ${modelId} not found`);

    const baseline = this.getBaseline();

    // Security violation guard
    if (candidate.metrics.securityRejectionRate > baseline.metrics.securityRejectionRate * 1.25) {
      candidate.rollbackTriggered = true;
      candidate.rollbackReason = `SECURITY_REGRESSION: Rejection rate (${(candidate.metrics.securityRejectionRate * 100).toFixed(1)}%) is above baseline allowance`;
      this.auditRoutingDecision(modelId, "ROLLBACK_ENFORCED", candidate.rollbackReason);
      return {
        promoted: false,
        reason: candidate.rollbackReason,
      };
    }

    // Quality degradation guard
    if (candidate.metrics.qualityScore < baseline.metrics.qualityScore - 0.05) {
      candidate.rollbackTriggered = true;
      candidate.rollbackReason = `QUALITY_DEGRADATION: Quality score (${(candidate.metrics.qualityScore * 100).toFixed(1)}%) dropped below acceptable margin`;
      this.auditRoutingDecision(modelId, "ROLLBACK_ENFORCED", candidate.rollbackReason);
      return {
        promoted: false,
        reason: candidate.rollbackReason,
      };
    }

    // Stage progression pipeline
    const stages: RoutingStage[] = [
      "offline_ranking",
      "shadow_evaluation",
      "canary_traffic",
      "guarded_adaptation",
      "approved_release",
    ];

    const currentIndex = stages.indexOf(candidate.stage);
    if (currentIndex >= stages.length - 1) {
      return { promoted: false, reason: "Already at highest release stage" };
    }

    const nextStage = stages[currentIndex + 1];
    candidate.stage = nextStage;
    if (nextStage === "canary_traffic") {
      candidate.trafficWeight = 10;
      baseline.trafficWeight = 90;
    } else if (nextStage === "guarded_adaptation") {
      candidate.trafficWeight = 35;
      baseline.trafficWeight = 65;
    } else if (nextStage === "approved_release") {
      candidate.trafficWeight = 100;
      baseline.trafficWeight = 0;
      baseline.isBaseline = false;
      candidate.isBaseline = true;
    }

    candidate.score = routeScore(candidate.metrics);

    this.auditRoutingDecision(modelId, "STAGE_PROMOTED", `Promoted to ${nextStage}`);

    return {
      promoted: true,
      reason: `Successfully graduated to ${nextStage}`,
      nextStage,
    };
  }

  /**
   * Selects model for a given task complexity
   */
  public selectRouteForTask(complexity: "low" | "medium" | "high"): {
    modelId: string;
    stage: RoutingStage;
    reason: string;
  } {
    const list = this.getProfiles().filter((p) => !p.rollbackTriggered && p.stage !== "offline_ranking");

    if (complexity === "low") {
      // Prefer fast/cost-effective if in canary or approved
      const fastOption = list.find((p) => p.modelId.includes("flash") && p.stage !== "shadow_evaluation");
      if (fastOption) {
        return {
          modelId: fastOption.modelId,
          stage: fastOption.stage,
          reason: "LOW_COMPLEXITY_ROUTED_TO_FAST_CANARY",
        };
      }
    }

    const baseline = this.getBaseline();
    return {
      modelId: baseline.modelId,
      stage: baseline.stage,
      reason: "COMPLEX_OR_HIGH_SECURITY_ROUTED_TO_BASELINE",
    };
  }

  private auditRoutingDecision(modelId: string, action: string, details: string) {
    auditLedger.record({
      tenantId: "system_router",
      eventType: `MODEL_ROUTING_${action}`,
      actorId: "adaptive_router",
      actorType: "system",
      details: {
        modelId,
        action,
        details,
      },
    });
  }
}

export const adaptiveModelRouter = new AdaptiveModelRouter();
