/**
 * AI Workbench - Sprint 13: Autonomous Operations & Platform Intelligence Test Suite
 * Automated Verification
 */

import { validateActionSafety } from "../../packages/intelligence/src/action-classification";
import { failureDiagnosisEngine } from "../../packages/intelligence/src/diagnosis-engine";
import { predictiveCapacityForecaster } from "../../packages/intelligence/src/capacity-forecaster";
import { costAwareExecutionOptimizer } from "../../packages/intelligence/src/cost-aware-execution";
import { policySimulator } from "../../packages/policy/src/simulator";
import { automatedCanaryAnalyzer } from "../../packages/intelligence/src/canary-analyzer";
import { automatedRunRecoveryService } from "../../packages/intelligence/src/run-recovery";
import { sandboxHygieneController } from "../../packages/sandbox/src/hygiene";
import { lifecycleAutomationManager } from "../../packages/intelligence/src/lifecycle-automation";
import { guardedAutonomousController } from "../../packages/intelligence/src/autonomous-controller";

export interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
}

export async function runAutonomousOperationsTestSuite(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const assert = (condition: boolean, msg: string) => {
    if (!condition) throw new Error(msg);
  };

  // Test 1: Action Classification & Safety Invariants
  {
    const start = Date.now();
    try {
      // 1A: Prohibited action (disable RLS)
      const rlsCheck = validateActionSafety("act_disable_rls");
      assert(rlsCheck.isProhibited, "Disabling RLS must be classified as prohibited");
      assert(!rlsCheck.isAllowed, "Prohibited action cannot be allowed");

      // 1B: Auto-safe action (retry idempotent)
      const safeCheck = validateActionSafety("act_retry_idempotent_step");
      assert(safeCheck.isAllowed && !safeCheck.requiresHumanReview, "Idempotent retry must be auto-safe");

      // 1C: Approval-required action (cross-region failover)
      const approvalCheck = validateActionSafety("act_cross_region_failover");
      assert(approvalCheck.requiresHumanReview, "Cross-region failover must require human approval");

      results.push({
        name: "1. Action Classification: Blocks prohibited invariants, allows auto_safe, gates approval_required",
        passed: true,
        durationMs: Date.now() - start,
        details: "Strictly blocked disable_rls; permitted retry_idempotent_step; gated cross_region_failover",
      });
    } catch (e: any) {
      results.push({
        name: "1. Action Classification: Blocks prohibited invariants, allows auto_safe, gates approval_required",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 2: Failure Diagnosis Engine
  {
    const start = Date.now();
    try {
      const diagnosis = failureDiagnosisEngine.diagnose({
        runId: "run_test_oom_99",
        tenantId: "tenant_fintech_01",
        sandboxExitCode: 137,
        sandboxErrorOutput: "Process Killed by cgroups out-of-memory killer",
        runStatus: "failed",
      });

      assert(diagnosis.confidence >= 0.95, "Confidence should exceed 0.95 for clear OOM 137 signal");
      assert(diagnosis.probableCause.includes("OOM"), "Probable cause must identify OOM");
      assert(diagnosis.recommendedActions.some((a) => a.actionType === "drain_worker"), "Must recommend worker drain");
      assert(diagnosis.recommendedActions.some((a) => a.actionType === "retry_step"), "Must recommend step retry");

      results.push({
        name: "2. Failure Diagnosis Engine: Diagnoses cgroups OOM with 98% confidence and generates recommendations",
        passed: true,
        durationMs: Date.now() - start,
        details: `Identified ${diagnosis.probableCause} (Confidence: ${(diagnosis.confidence * 100).toFixed(0)}%)`,
      });
    } catch (e: any) {
      results.push({
        name: "2. Failure Diagnosis Engine: Diagnoses cgroups OOM with 98% confidence and generates recommendations",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 3: Predictive Capacity Planning
  {
    const start = Date.now();
    try {
      const forecast = predictiveCapacityForecaster.generateForecast(4);
      assert(forecast.predictedPeakConcurrency > 0, "Must calculate positive peak concurrency");
      assert(forecast.requiredWorkers > 0, "Must compute worker requirement");

      const plan = predictiveCapacityForecaster.evaluateAutoscaling(forecast, {
        activeWorkers: 4,
        warmSandboxes: 5,
        budgetCeilingUsd: 15.0,
      });

      assert(plan.approvedForExecution, "Plan must be evaluated and approved within budget");
      assert(plan.projectedCostUsd <= plan.budgetCeilingUsd, "Projected cost must remain within budget cap");

      results.push({
        name: "3. Predictive Capacity Planning: Projects peak concurrency and schedules pre-warm within budget",
        passed: true,
        durationMs: Date.now() - start,
        details: `Forecasted ${forecast.predictedPeakConcurrency} peak concurrency; planned ${plan.preWarmSandboxCount} pre-warmed sandboxes`,
      });
    } catch (e: any) {
      results.push({
        name: "3. Predictive Capacity Planning: Projects peak concurrency and schedules pre-warm within budget",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 4: Cost-Aware Step Execution Optimizer
  {
    const start = Date.now();
    try {
      // 4A: Economically viable step approved
      const goodStep = costAwareExecutionOptimizer.evaluateStep(
        {
          stepName: "code_format_and_lint",
          expectedValue: 8.0,
          estimatedCost: 0.05,
          estimatedDurationMs: 1200,
          probabilityOfSuccess: 0.95,
          canBeSkipped: false,
        },
        10.0 // generous budget
      );
      assert(goodStep.approved, "Viable step must be approved");
      assert(goodStep.recommendedModelTier === "flash", "Simple task should recommend flash tier");

      // 4B: Low-utility optional step rejected
      const wastefulStep = costAwareExecutionOptimizer.evaluateStep(
        {
          stepName: "speculative_ast_beautify",
          expectedValue: 0.02,
          estimatedCost: 0.25,
          estimatedDurationMs: 5000,
          probabilityOfSuccess: 0.10,
          canBeSkipped: true,
        },
        10.0
      );
      assert(!wastefulStep.approved, "Wasteful optional step must be rejected on low utility");

      results.push({
        name: "4. Cost-Aware Execution: Approves cost-effective steps and prunes low-utility speculative steps",
        passed: true,
        durationMs: Date.now() - start,
        details: "Approved high-utility linting (flash tier); rejected speculative step with low expected value",
      });
    } catch (e: any) {
      results.push({
        name: "4. Cost-Aware Execution: Approves cost-effective steps and prunes low-utility speculative steps",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 5: Policy Simulator & Replay
  {
    const start = Date.now();
    try {
      // Candidate policy that accidentally allows merge to main without approval
      const dangerousRules = [
        {
          actionPattern: "read:*",
          riskLevel: "low" as const,
          requiredApprovals: 0,
          dualApproverRequired: false,
          tracingLevel: "sampled" as const,
          description: "Read files",
        },
        {
          actionPattern: "github:merge_main",
          riskLevel: "critical" as const,
          requiredApprovals: 0, // DANGEROUS: Relaxed from 2 to 0
          dualApproverRequired: false,
          tracingLevel: "sampled" as const,
          description: "Unapproved merge to main",
        },
      ];

      const sim = policySimulator.simulatePolicyCandidate("candidate_v2.0_relaxed", dangerousRules);
      assert(!sim.passedSafetyCheck, "Policy relaxing critical action to 0 approvals must fail simulation");
      assert(sim.highRiskDifferences > 0, "Must detect high risk differences");
      assert(sim.blockReasons.some((r) => r.includes("UNGUARDED_HIGH_RISK")), "Must output unguarded high risk warning");

      results.push({
        name: "5. Policy Simulator: Replays historical decisions and blocks relaxed high-risk policies",
        passed: true,
        durationMs: Date.now() - start,
        details: `Flagged ${sim.highRiskDifferences} unguarded high-risk actions and blocked candidate policy`,
      });
    } catch (e: any) {
      results.push({
        name: "5. Policy Simulator: Replays historical decisions and blocks relaxed high-risk policies",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 6: Automated Canary Analysis
  {
    const start = Date.now();
    try {
      // 6A: Clean slice advances
      const cleanMetrics = {
        errorRate: 0.012,
        p95LatencyMs: 2200,
        firstTokenLatencyMs: 340,
        patchAcceptanceRate: 0.96,
        testsPassRate: 0.99,
        securityRejections: 0,
        fallbackRate: 0.01,
        costPerRunUsd: 0.17,
        duplicateExternalActions: 0,
      };
      const advanceResult = automatedCanaryAnalyzer.evaluateCanary("rel-canary-01", 1, cleanMetrics);
      assert(advanceResult.decision === "advance", "Clean candidate should advance");
      assert(advanceResult.nextTrafficWeight === 5, "Should advance traffic from 1% to 5%");

      // 6B: Security rejection enforces instant rollback
      const taintedMetrics = {
        ...cleanMetrics,
        securityRejections: 1, // Any security violation triggers instant rollback
      };
      const rollbackResult = automatedCanaryAnalyzer.evaluateCanary("rel-canary-02", 5, taintedMetrics);
      assert(rollbackResult.decision === "rollback", "Candidate with security violation must be rolled back");
      assert(rollbackResult.nextTrafficWeight === 0, "Rollback traffic weight must be 0%");

      results.push({
        name: "6. Automated Canary Analysis: Advances compliant slices and enforces instant rollback on security breach",
        passed: true,
        durationMs: Date.now() - start,
        details: "Canary advanced 1% -> 5%; instantly rolled back to 0% upon security rejection",
      });
    } catch (e: any) {
      results.push({
        name: "6. Automated Canary Analysis: Advances compliant slices and enforces instant rollback on security breach",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 7: Automated Run Recovery with Idempotency Guard
  {
    const start = Date.now();
    try {
      // 7A: Transient provider timeout with idempotency key -> auto resume
      const recoverable = automatedRunRecoveryService.assessAndRecover(
        "run_transient_01",
        "tenant_fintech_01",
        "provider_timeout",
        true
      );
      assert(recoverable.isAutoRecoverable, "Transient provider timeout must be auto-recoverable");
      assert(recoverable.resolutionStrategy === "auto_resume_idempotent", "Strategy should be auto_resume_idempotent");

      // 7B: Security violation -> never auto-recover, open incident
      const unrecoverable = automatedRunRecoveryService.assessAndRecover(
        "run_sec_violation_01",
        "tenant_fintech_01",
        "policy_denial",
        true
      );
      assert(!unrecoverable.isAutoRecoverable, "Policy denial must NEVER be auto-recovered");
      assert(unrecoverable.requiresIncidentTicket, "Must require security incident ticket");

      results.push({
        name: "7. Automated Run Recovery: Resumes idempotent transient faults; opens incident on security breach",
        passed: true,
        durationMs: Date.now() - start,
        details: "Auto-resumed transient provider timeout; locked down policy denial",
      });
    } catch (e: any) {
      results.push({
        name: "7. Automated Run Recovery: Resumes idempotent transient faults; opens incident on security breach",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 8: Sandbox Hygiene & Quarantine
  {
    const start = Date.now();
    try {
      // Clean hygiene
      const cleanResult = sandboxHygieneController.sanitizeAndVerify("sbx_test_clean", false);
      assert(cleanResult.status === "clean", "Properly scrubbed sandbox must be clean");

      // Dirty hygiene -> quarantine
      const dirtyResult = sandboxHygieneController.sanitizeAndVerify("sbx_test_dirty", true);
      assert(dirtyResult.status === "quarantined", "Failed scrub sandbox must be quarantined");
      assert(sandboxHygieneController.isQuarantined("sbx_test_dirty"), "Must be tracked in quarantine pool");

      results.push({
        name: "8. Sandbox Hygiene Sentinel: Sanitizes ephemeral filesystems and quarantines tainted pools",
        passed: true,
        durationMs: Date.now() - start,
        details: "Scrubbed clean sandbox verified; tainted sandbox successfully isolated into quarantine",
      });
    } catch (e: any) {
      results.push({
        name: "8. Sandbox Hygiene Sentinel: Sanitizes ephemeral filesystems and quarantines tainted pools",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 9: Agent & Tool Lifecycle Automation
  {
    const start = Date.now();
    try {
      // Agent health evaluation restricts high-rejection agent
      const health = lifecycleAutomationManager.evaluateAgentHealth("agent_legacy_scripter_v1");
      assert(health.restricted, "Agent with 9.5% security rejection must be restricted");

      // Tool compliance checks
      const validTool = lifecycleAutomationManager.verifyToolCompliance("tool_git_commit");
      assert(validTool.isCompliant, "Compliant tool must pass all 7 compliance gates");

      const badTool = lifecycleAutomationManager.verifyToolCompliance("tool_network_curl");
      assert(!badTool.isCompliant, "Unsigned tool with open network egress must fail compliance");
      assert(badTool.failingGates.length >= 2, "Must identify multiple failing compliance gates");

      results.push({
        name: "9. Lifecycle Automation: Enforces agent auto-restriction and validates 7 tool compliance gates",
        passed: true,
        durationMs: Date.now() - start,
        details: "Restricted high-rejection agent; verified git_commit compliance; rejected unverified curl tool",
      });
    } catch (e: any) {
      results.push({
        name: "9. Lifecycle Automation: Enforces agent auto-restriction and validates 7 tool compliance gates",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 10: Guarded Autonomous Controller Loop & Out-of-Band Kill Switch
  {
    const start = Date.now();
    try {
      // 10A: Complete cycle execution
      const cycle = await guardedAutonomousController.executeCycle(
        {
          runId: "run_auto_loop_01",
          tenantId: "tenant_fintech_01",
          sandboxExitCode: 124,
          runStatus: "failed",
        },
        "act_retry_idempotent_step",
        false
      );
      assert(cycle.executionStatus === "SUCCESS", "Auto-safe cycle must succeed");
      assert(cycle.verificationPassed, "Verification phase must pass");

      // 10B: Verification failure triggers immediate rollback
      const failedCycle = await guardedAutonomousController.executeCycle(
        {
          runId: "run_auto_loop_02",
          tenantId: "tenant_fintech_01",
          sandboxExitCode: 137,
          runStatus: "failed",
        },
        "act_retry_idempotent_step",
        true // Simulate verification failure
      );
      assert(failedCycle.executionStatus === "VERIFICATION_FAILED", "Should catch verification failure");
      assert(failedCycle.rollbackExecuted, "Must trigger automated rollback on verification failure");

      // 10C: Kill switch halts all autonomous actions immediately
      guardedAutonomousController.setKillSwitch(true, "sec_officer_root");
      assert(guardedAutonomousController.isKillSwitchActive(), "Kill switch must be engaged");

      let killSwitchBlocked = false;
      try {
        await guardedAutonomousController.executeCycle(
          {
            runId: "run_auto_loop_03",
            tenantId: "tenant_fintech_01",
            runStatus: "failed",
          },
          "act_retry_idempotent_step"
        );
      } catch (err: any) {
        if (err.message.includes("KILL_SWITCH_ACTIVE")) {
          killSwitchBlocked = true;
        }
      }
      assert(killSwitchBlocked, "Kill switch must block execution with error");

      // Reset kill switch
      guardedAutonomousController.setKillSwitch(false, "sec_officer_root");
      assert(!guardedAutonomousController.isKillSwitchActive(), "Kill switch should be disengaged");

      results.push({
        name: "10. Guarded Autonomous Controller: Executes observe->diagnose->verify loop, verifies rollback & kill switch",
        passed: true,
        durationMs: Date.now() - start,
        details: "Verified full loop; auto-rollback executed on verification failure; kill switch halts controller",
      });
    } catch (e: any) {
      results.push({
        name: "10. Guarded Autonomous Controller: Executes observe->diagnose->verify loop, verifies rollback & kill switch",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  return results;
}
