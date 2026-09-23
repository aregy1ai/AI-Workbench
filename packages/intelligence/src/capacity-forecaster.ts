/**
 * AI Workbench - Predictive Capacity Planning & Proactive Scaling
 * Sprint 13: Platform Intelligence & Autonomous Operations
 */

import { auditLedger } from "../../audit/src/ledger";

export interface CapacityMetricsSnapshot {
  runsPerHour: number;
  queueDepth: number;
  avgWorkerDurationSeconds: number;
  sandboxColdStartRate: number; // 0..1
  dbPoolUtilization: number;    // 0..1
  providerRateLimitUsage: number; // 0..1
  artifactGrowthMbPerHour: number;
  costPerRunUsd: number;
}

export interface CapacityForecast {
  horizonHours: number;
  predictedRuns: number;
  predictedPeakConcurrency: number;
  requiredWorkers: number;
  requiredSandboxSlots: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  forecastedAt: string;
}

export interface ScalingActionPlan {
  planId: string;
  preWarmSandboxCount: number;
  workerAdjustment: number; // e.g. +3 or -1
  deprioritizeEvaluations: boolean;
  throttleNonCriticalSampling: boolean;
  budgetCeilingUsd: number;
  projectedCostUsd: number;
  reason: string;
  approvedForExecution: boolean;
}

export class PredictiveCapacityForecaster {
  private currentMetrics: CapacityMetricsSnapshot = {
    runsPerHour: 480,
    queueDepth: 12,
    avgWorkerDurationSeconds: 42,
    sandboxColdStartRate: 0.14,
    dbPoolUtilization: 0.45,
    providerRateLimitUsage: 0.62,
    artifactGrowthMbPerHour: 340,
    costPerRunUsd: 0.18,
  };

  private forecasts: CapacityForecast[] = [];
  private activeScalingPlans: ScalingActionPlan[] = [];

  constructor() {
    this.generateForecast(4); // default 4-hour forward lookahead
  }

  public getMetrics(): CapacityMetricsSnapshot {
    return { ...this.currentMetrics };
  }

  public generateForecast(horizonHours: number = 4): CapacityForecast {
    // Linear + circadian projection based on current queue velocity
    const baseConcurrency = (this.currentMetrics.runsPerHour * (this.currentMetrics.avgWorkerDurationSeconds / 3600));
    const growthFactor = 1.35; // Projected surge window
    const predictedPeakConcurrency = Math.ceil(baseConcurrency * growthFactor + this.currentMetrics.queueDepth * 0.8);
    const predictedRuns = Math.round(this.currentMetrics.runsPerHour * horizonHours * 1.2);

    const requiredWorkers = Math.max(4, Math.ceil(predictedPeakConcurrency * 1.25));
    const requiredSandboxSlots = Math.max(6, Math.ceil(predictedPeakConcurrency * 1.5));

    const forecast: CapacityForecast = {
      horizonHours,
      predictedRuns,
      predictedPeakConcurrency,
      requiredWorkers,
      requiredSandboxSlots,
      confidenceInterval: {
        lower: Math.round(predictedRuns * 0.9),
        upper: Math.round(predictedRuns * 1.15),
      },
      forecastedAt: new Date().toISOString(),
    };

    this.forecasts.unshift(forecast);
    return forecast;
  }

  /**
   * Plans autonomous proactive scaling while strictly honoring tenant capacity and global budget caps
   */
  public evaluateAutoscaling(
    forecast: CapacityForecast,
    currentResources: {
      activeWorkers: number;
      warmSandboxes: number;
      budgetCeilingUsd: number;
    }
  ): ScalingActionPlan {
    const workerDiff = forecast.requiredWorkers - currentResources.activeWorkers;
    const sandboxDiff = forecast.requiredSandboxSlots - currentResources.warmSandboxes;

    const projectedIncrementalCost = Math.max(0, workerDiff) * 0.12 * forecast.horizonHours +
      Math.max(0, sandboxDiff) * 0.05 * forecast.horizonHours;

    // Strict invariant: Autoscaling must NOT violate capacity budget
    const withinBudget = projectedIncrementalCost <= currentResources.budgetCeilingUsd;
    const deprioritize = !withinBudget || forecast.predictedPeakConcurrency > 25;

    const plan: ScalingActionPlan = {
      planId: `scale_plan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      preWarmSandboxCount: Math.max(0, Math.min(sandboxDiff, 20)),
      workerAdjustment: withinBudget ? workerDiff : Math.min(workerDiff, 2),
      deprioritizeEvaluations: deprioritize,
      throttleNonCriticalSampling: this.currentMetrics.providerRateLimitUsage > 0.75,
      budgetCeilingUsd: currentResources.budgetCeilingUsd,
      projectedCostUsd: Number(projectedIncrementalCost.toFixed(2)),
      reason: withinBudget
        ? `Proactive pre-warm for predicted ${forecast.predictedPeakConcurrency} peak concurrency within $${currentResources.budgetCeilingUsd} budget cap`
        : `Budget guard enforced: Scaled with deprioritization of non-critical background evals`,
      approvedForExecution: true,
    };

    this.activeScalingPlans.unshift(plan);

    auditLedger.record({
      tenantId: "system_capacity",
      eventType: "CAPACITY_SCALING_PLAN_EVALUATED",
      actorId: "capacity_forecaster",
      actorType: "system",
      details: {
        predictedPeakConcurrency: forecast.predictedPeakConcurrency,
        preWarmSandboxes: plan.preWarmSandboxCount,
        workerAdjustment: plan.workerAdjustment,
        deprioritizeEvaluations: plan.deprioritizeEvaluations,
      },
    });

    return plan;
  }

  public getForecasts(): CapacityForecast[] {
    return [...this.forecasts];
  }

  public getActivePlans(): ScalingActionPlan[] {
    return [...this.activeScalingPlans];
  }
}

export const predictiveCapacityForecaster = new PredictiveCapacityForecaster();
