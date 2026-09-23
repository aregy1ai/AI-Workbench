/**
 * AI Workbench - Cost-Aware Step Execution & Economic Utility Optimizer
 * Sprint 13: Platform Intelligence & Autonomous Operations
 */

import { auditLedger } from "../../audit/src/ledger";

export interface StepEconomics {
  stepName: string;
  expectedValue: number;         // Monetary value metric (0.0 to 10.0 scale)
  estimatedCost: number;         // Estimated cost in USD
  estimatedDurationMs: number;
  probabilityOfSuccess: number;  // 0.0 to 1.0 based on historical passes
  canBeSkipped: boolean;
  modelTierRecommended?: "flash" | "pro" | "heuristic";
}

export interface StepExecutionVerdict {
  approved: boolean;
  reason: string;
  expectedUtility: number;
  costEfficiencyRatio: number;
  recommendedModelTier: "flash" | "pro" | "heuristic";
  shouldTearDownSandboxImmediately: boolean;
}

export class CostAwareExecutionOptimizer {
  /**
   * Evaluates economic viability of a step execution against remaining run budget
   * Invariant: This is an economic decision, NOT a security bypass.
   * If approved, it must still pass the Policy Engine before execution.
   */
  public evaluateStep(
    economics: StepEconomics,
    budgetRemainingUsd: number,
    consecutiveFailures: number = 0
  ): StepExecutionVerdict {
    const expectedUtility = economics.expectedValue * economics.probabilityOfSuccess;
    const costEfficiencyRatio = economics.estimatedCost > 0
      ? Number((expectedUtility / economics.estimatedCost).toFixed(2))
      : 100;

    // Rule 1: Remaining budget cannot be breached
    if (economics.estimatedCost > budgetRemainingUsd) {
      return {
        approved: false,
        reason: `BUDGET_EXHAUSTED: Step requires $${economics.estimatedCost.toFixed(3)}, but remaining budget is only $${budgetRemainingUsd.toFixed(3)}`,
        expectedUtility,
        costEfficiencyRatio,
        recommendedModelTier: "flash",
        shouldTearDownSandboxImmediately: true,
      };
    }

    // Rule 2: Escalation freeze if repeated consecutive failures
    if (consecutiveFailures >= 3 && economics.canBeSkipped) {
      return {
        approved: false,
        reason: `REPEATED_FAILURE_CIRCUIT_BREAKER: Skipped step after ${consecutiveFailures} consecutive failures. Probability of recovery below economic threshold.`,
        expectedUtility,
        costEfficiencyRatio,
        recommendedModelTier: "heuristic",
        shouldTearDownSandboxImmediately: true,
      };
    }

    // Rule 3: Economic utility evaluation
    // If utility > cost OR step is mandatory (!canBeSkipped)
    const economicallyViable = expectedUtility >= economics.estimatedCost || !economics.canBeSkipped;

    if (!economicallyViable) {
      return {
        approved: false,
        reason: `LOW_ECONOMIC_UTILITY: Expected utility ($${expectedUtility.toFixed(3)}) is below execution cost ($${economics.estimatedCost.toFixed(3)}) on an optional step.`,
        expectedUtility,
        costEfficiencyRatio,
        recommendedModelTier: "flash",
        shouldTearDownSandboxImmediately: false,
      };
    }

    // Tier recommendation: For high-probability or simple tasks, recommend cost-effective flash tier
    const tier: "flash" | "pro" | "heuristic" =
      economics.probabilityOfSuccess > 0.85 || economics.stepName.includes("summarize") || economics.stepName.includes("lint")
        ? "flash"
        : "pro";

    return {
      approved: true,
      reason: `APPROVED_ECONOMIC_UTILITY: Utility $${expectedUtility.toFixed(3)} justifies spend $${economics.estimatedCost.toFixed(3)} (${tier.toUpperCase()} tier)`,
      expectedUtility,
      costEfficiencyRatio,
      recommendedModelTier: tier,
      shouldTearDownSandboxImmediately: false,
    };
  }

  public recordDecision(
    tenantId: string,
    runId: string,
    stepName: string,
    verdict: StepExecutionVerdict
  ) {
    auditLedger.record({
      tenantId,
      runId,
      eventType: "COST_AWARE_STEP_EVALUATED",
      actorId: "cost_aware_optimizer",
      actorType: "system",
      details: {
        stepName,
        approved: verdict.approved,
        expectedUtility: verdict.expectedUtility,
        modelTier: verdict.recommendedModelTier,
        reason: verdict.reason,
      },
    });
  }
}

export const costAwareExecutionOptimizer = new CostAwareExecutionOptimizer();
