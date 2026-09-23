/**
 * AI Workbench - Continuous Improvement & Governance 2.0 Test Suite
 * Sprint 12 Test Verification
 */

import { failureIntelligence } from "../../packages/governance/src/failure-intelligence";
import { feedbackAndEvalEngine } from "../../packages/governance/src/feedback-eval";
import { adaptiveModelRouter, routeScore } from "../../packages/governance/src/adaptive-router";
import { costAnomalySentinel } from "../../packages/budget/src/cost-anomaly";
import { riskAdaptivePolicyEngine } from "../../packages/policy/src/risk-adaptive";
import { agentCapabilityReviewBoard } from "../../packages/governance/src/capability-review";
import { complianceAndDisasterRecoveryService } from "../../packages/governance/src/compliance-adr";

export interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
}

export async function runContinuousImprovementTestSuite(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Helper assertion
  const assert = (condition: boolean, msg: string) => {
    if (!condition) throw new Error(msg);
  };

  // Test 1: Failure Intelligence & Root Cause Taxonomy
  {
    const start = Date.now();
    try {
      const rec = failureIntelligence.recordFailure({
        tenantId: "tenant_test_12",
        runId: "run_fail_test_01",
        category: "authorization_rejection",
        severity: "high",
        symptom: "Forbidden syscall attempted: chmod +s /bin/bash",
        rootCause: "Agent prompt unconstrained container escalation",
        remediationLayer: "policy",
        retryable: false,
        detectedBy: "SeccompFilterSentinel",
      });

      assert(rec.id.startsWith("fail_"), "Failure record ID must be generated");
      const clusters = failureIntelligence.clusterFailures("tenant_test_12");
      assert(clusters.length > 0, "Must create failure clusters");
      assert(clusters[0].category === "authorization_rejection", "Category must match cluster");

      const regressionCase = failureIntelligence.generateRegressionTestCase(rec.id);
      assert(regressionCase.testCaseId.includes("eval_reg_"), "Must generate offline regression test case");

      results.push({
        name: "1. Failure Intelligence: Records, clusters, and generates regression test case",
        passed: true,
        durationMs: Date.now() - start,
        details: `Clustered ${clusters.length} categories; created regression case ${regressionCase.testCaseId}`,
      });
    } catch (e: any) {
      results.push({
        name: "1. Failure Intelligence: Records, clusters, and generates regression test case",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 2: Quality Feedback Loop & Trace Redaction
  {
    const start = Date.now();
    try {
      const rawText = "Agent leaked token ghp_superSecretToken12345678 and Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test and sk_live_liveKey9988776655 in comment";
      const redacted = feedbackAndEvalEngine.redactTrace(rawText);

      assert(!redacted.includes("ghp_superSecretToken"), "GitHub PAT must be redacted");
      assert(!redacted.includes("eyJhbGciOiJIUzI1NiJ9"), "JWT Bearer token must be redacted");
      assert(!redacted.includes("sk_live_liveKey"), "Live API key must be redacted");
      assert(redacted.includes("[REDACTED_SECRET]") || redacted.includes("[REDACTED_AUTH_TOKEN]"), "Must replace secrets with placeholder");

      const fb = feedbackAndEvalEngine.submitFeedback({
        runId: "run_test_redact_01",
        tenantId: "tenant_test_12",
        source: "reviewer",
        label: "partially_correct",
        category: "patch_scope",
        evidenceArtifactIds: ["art_redact_diff"],
        rawComment: rawText,
      });

      const evalCase = feedbackAndEvalEngine.promoteFeedbackToEvalCase(fb.id, "ds-v2.5");
      assert(evalCase.targetDatasetVersion === "ds-v2.5", "Dataset version must be tagged");

      results.push({
        name: "2. Quality Feedback Loop: Sanitizes secrets and promotes to versioned eval case",
        passed: true,
        durationMs: Date.now() - start,
        details: "Cleanly redacted API keys and Bearer JWTs; produced eval case",
      });
    } catch (e: any) {
      results.push({
        name: "2. Quality Feedback Loop: Sanitizes secrets and promotes to versioned eval case",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 3: Release Regression Gate (Pass vs Fail)
  {
    const start = Date.now();
    try {
      // 3A: Clean release passes
      const cleanSummary = {
        datasetVersion: "ds-v2.5",
        releaseId: "rel-model-candidate-pass",
        candidateType: "model" as const,
        completedCases: 200,
        successRate: 0.96,
        testsPassRate: 0.98,
        securityViolations: 0,
        meanCost: 0.19,
        p95LatencyMs: 2300,
        humanApprovalRate: 0.93,
        evaluatedAt: new Date().toISOString(),
      };
      const passResult = feedbackAndEvalEngine.evaluateRegressionGate(cleanSummary);
      assert(passResult.status === "PASSED", "Clean candidate must pass regression gate");

      // 3B: Faulty release with security violation is blocked (Zero tolerance)
      const faultySummary = {
        datasetVersion: "ds-v2.5",
        releaseId: "rel-model-candidate-blocked",
        candidateType: "model" as const,
        completedCases: 200,
        successRate: 0.91,
        testsPassRate: 0.88, // Below 95%
        securityViolations: 2, // Violates zero tolerance
        meanCost: 0.45,
        p95LatencyMs: 4800,
        evaluatedAt: new Date().toISOString(),
      };
      const blockedResult = feedbackAndEvalEngine.evaluateRegressionGate(faultySummary);
      assert(blockedResult.status === "BLOCKED", "Faulty release must be blocked");
      assert(blockedResult.reasons.some((r) => r.includes("SECURITY_VIOLATION_BREACH")), "Must detect security violation breach");

      results.push({
        name: "3. Release Regression Gate: Certifies compliant candidate and blocks security/test regressions",
        passed: true,
        durationMs: Date.now() - start,
        details: "Zero-tolerance security guard triggered; passed compliant candidate",
      });
    } catch (e: any) {
      results.push({
        name: "3. Release Regression Gate: Certifies compliant candidate and blocks security/test regressions",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 4: Adaptive Model Routing Score Calculation
  {
    const start = Date.now();
    try {
      const highQualityMetrics = {
        qualityScore: 0.95,
        successRate: 0.92,
        p95LatencyMs: 2000,
        costPerRun: 0.15,
        fallbackRate: 0.01,
        securityRejectionRate: 0.002,
      };

      const score = routeScore(highQualityMetrics);
      assert(score > 0.80, `Score should be high for optimal metrics (got ${score})`);

      const baseline = adaptiveModelRouter.getBaseline();
      assert(baseline.isBaseline, "Must have an active baseline model profile");

      results.push({
        name: "4. Adaptive Model Routing: Multi-metric weighted score calculation",
        passed: true,
        durationMs: Date.now() - start,
        details: `Optimal metrics route score: ${score.toFixed(3)}`,
      });
    } catch (e: any) {
      results.push({
        name: "4. Adaptive Model Routing: Multi-metric weighted score calculation",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 5: Model Router Rejects Cost/Latency Optimization that Breaches Security or Quality
  {
    const start = Date.now();
    try {
      const evaluation = adaptiveModelRouter.evaluateStagePromotion("experimental-budget-llm");
      assert(!evaluation.promoted, "Experimental model with high security rejections must not be promoted");
      assert(evaluation.reason.includes("SECURITY_REGRESSION"), "Must trigger security regression rollback");

      results.push({
        name: "5. Model Router Guard: Rejects promotion if candidate degrades security or quality",
        passed: true,
        durationMs: Date.now() - start,
        details: `Promotion blocked with reason: ${evaluation.reason}`,
      });
    } catch (e: any) {
      results.push({
        name: "5. Model Router Guard: Rejects promotion if candidate degrades security or quality",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 6: Cost Anomaly Sentinel & Circuit Breaker
  {
    const start = Date.now();
    try {
      const check = costAnomalySentinel.detectAnomaly({
        tenantId: "tenant_fintech_01",
        runId: "run_runaway_99",
        baselineCost: 0.10,
        observedCost: 0.85, // 8.5x baseline deviation
        reason: "retry_loop",
      });

      assert(check.anomalyDetected, "Must detect anomaly for 8.5x spend deviation");
      assert(check.anomaly?.freezeEscalation === true, "Must freeze model escalation");
      assert(costAnomalySentinel.isEscalationFrozen("tenant_fintech_01"), "Tenant escalation must be frozen");

      costAnomalySentinel.unfreezeEscalation("tenant_fintech_01", "lead_admin_42");
      assert(!costAnomalySentinel.isEscalationFrozen("tenant_fintech_01"), "Escalation should be unfrozen after review");

      results.push({
        name: "6. Cost Anomaly Sentinel: Catches runaway loops and trips circuit breaker",
        passed: true,
        durationMs: Date.now() - start,
        details: `Detected 8.5x cost anomaly; successfully froze and unfroze escalation`,
      });
    } catch (e: any) {
      results.push({
        name: "6. Cost Anomaly Sentinel: Catches runaway loops and trips circuit breaker",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 7: Risk-Adaptive Policy & Two-Person Rule
  {
    const start = Date.now();
    try {
      // 7A: Low risk action (read) is permitted automatically
      const lowResult = riskAdaptivePolicyEngine.evaluateAction("read:src/index.ts", ["developer"]);
      assert(lowResult.allowed && !lowResult.approvalRequired, "Low risk action should be auto-permitted");

      // 7B: Critical risk action requires Two-Person Rule (2 distinct human approvers)
      const criticalResult = riskAdaptivePolicyEngine.evaluateAction("github:merge_main", ["developer"]);
      assert(!criticalResult.allowed, "Critical action must not be auto-permitted");
      assert(criticalResult.approvalsNeeded === 2, "Critical action must require 2 approvers");
      assert(criticalResult.dualApproverRequired, "Must enforce dualApproverRequired");

      results.push({
        name: "7. Risk-Adaptive Policy: Enforces zero-friction on low risk and Two-Person Rule on critical",
        passed: true,
        durationMs: Date.now() - start,
        details: `Low risk auto-allowed; critical merge_main mandates 2 human approvals`,
      });
    } catch (e: any) {
      results.push({
        name: "7. Risk-Adaptive Policy: Enforces zero-friction on low risk and Two-Person Rule on critical",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 8: Agent Capability Review & Rollback
  {
    const start = Date.now();
    try {
      const overdue = agentCapabilityReviewBoard.getOverdueReviews();
      assert(overdue.length > 0, "Must identify capabilities with security flags or inactivity");

      const target = overdue[0];
      const originalDecision = target.decision;
      const newDecision = originalDecision === "suspend" ? "remove" : "suspend";

      const updated = agentCapabilityReviewBoard.updateDecision(
        target.id,
        newDecision,
        "Updated during sprint 12 governance sweep",
        "sec_auditor_01"
      );
      assert(updated.decision === newDecision, "Capability decision must be updated");

      const rolledBack = agentCapabilityReviewBoard.rollbackDecision(target.id, "sec_auditor_01");
      assert(rolledBack.decision === originalDecision, "Capability decision must rollback to previous state");

      results.push({
        name: "8. Agent Capability Review: Tracks lifecycle, applies governance decisions and rollback",
        passed: true,
        durationMs: Date.now() - start,
        details: `Identified ${overdue.length} flagged capabilities; verified decision update and rollback`,
      });
    } catch (e: any) {
      results.push({
        name: "8. Agent Capability Review: Tracks lifecycle, applies governance decisions and rollback",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 9: Compliance Evidence Export & Cryptographic Integrity
  {
    const start = Date.now();
    try {
      const exp = complianceAndDisasterRecoveryService.generateComplianceExport("tenant_fintech_01", {
        start: "2026-08-01T00:00:00Z",
        end: "2026-08-31T23:59:59Z",
      });

      assert(exp.id.startsWith("exp_"), "Must generate export ID");
      assert(exp.integrityHash.includes("sha256_"), "Must contain cryptographic integrity hash");
      assert(exp.verified, "Integrity verification flag must be true");

      results.push({
        name: "9. Compliance Evidence: Bundles artifacts with tamper-evident cryptographic hash",
        passed: true,
        durationMs: Date.now() - start,
        details: `Exported bundle ${exp.id} with digest ${exp.integrityHash.substring(0, 24)}...`,
      });
    } catch (e: any) {
      results.push({
        name: "9. Compliance Evidence: Bundles artifacts with tamper-evident cryptographic hash",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 10: Disaster Recovery Drill (RTO & RPO Verification)
  {
    const start = Date.now();
    try {
      const drill = complianceAndDisasterRecoveryService.executeDisasterRecoveryDrill();

      assert(drill.overallStatus === "PASSED", "DR drill must pass all checklist items");
      assert(drill.actualRtoMinutes < drill.rtoTargetMinutes, `Actual RTO (${drill.actualRtoMinutes}m) must be under target (${drill.rtoTargetMinutes}m)`);
      assert(drill.actualRpoMinutes <= drill.rpoTargetMinutes, `Actual RPO (${drill.actualRpoMinutes}m) must be under target (${drill.rpoTargetMinutes}m)`);
      assert(drill.checks.rlsTenantScopeVerified, "Must verify RLS tenant boundary");
      assert(drill.checks.auditChainIntact, "Must verify cryptographic audit hash chain");

      results.push({
        name: "10. Disaster Recovery Drill: Verifies DB restore, RLS scope, and meets RTO/RPO targets",
        passed: true,
        durationMs: Date.now() - start,
        details: `Achieved RTO: ${drill.actualRtoMinutes} min (Target < 15m), RPO: ${drill.actualRpoMinutes} min (Target < 1m)`,
      });
    } catch (e: any) {
      results.push({
        name: "10. Disaster Recovery Drill: Verifies DB restore, RLS scope, and meets RTO/RPO targets",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  return results;
}
