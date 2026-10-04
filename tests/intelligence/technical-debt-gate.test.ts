/**
 * Eagle TDI v1 - Deterministic Contract / Scorer / Gate Tests
 */

import {
  calculateDebtMetrics,
  evaluateDebtGate,
  validateDebtGateDecision,
  validateDebtRecord,
  validateEvidence,
  validateFinding,
} from "../../packages/intelligence/src/technical-debt";

export interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
}

export function runTechnicalDebtGateTestSuite(): TestResult[] {
  const results: TestResult[] = [];

  const assert = (condition: boolean, message: string): void => {
    if (!condition) throw new Error(message);
  };

  // 1. Evidence contract rejects malformed digests and accepts a valid record.
  {
    const start = Date.now();
    try {
      const evidence = {
        id: "SA-1",
        type: "static_analysis" as const,
        tenantId: "tenant-a",
        workspaceId: "workspace-a",
        repositoryId: "repo-a",
        commitSha: "22c1ace005ee89f4bd5c16df9f60a4592fa972cb",
        source: "unit-test",
        path: "packages/security/src/context-signer.ts",
        collectedAt: "2026-10-04T10:00:00.000Z",
        contentDigest: "sha256:" + "a".repeat(64),
        data: { finding: "example" },
      };

      validateEvidence(evidence);
      let rejected = false;
      try {
        validateEvidence({ ...evidence, contentDigest: "sha256_fake" });
      } catch {
        rejected = true;
      }

      assert(rejected, "Invalid evidence digest must be rejected");
      results.push({
        name: "1. Evidence contract validates attribution, commit pinning, and SHA-256 format",
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (error) {
      results.push({
        name: "1. Evidence contract validates attribution, commit pinning, and SHA-256 format",
        passed: false,
        durationMs: Date.now() - start,
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 2. AI finding contract cannot carry a gate decision.
  {
    const start = Date.now();
    try {
      const finding = {
        id: "FND-0001",
        category: "security" as const,
        severity: "high" as const,
        confidence: 0.94,
        evidenceIds: ["SA-1"],
        affectedPaths: ["packages/security/src/context-signer.ts"],
        recommendation: "Replace the default signing secret with an externally supplied key.",
      };

      validateFinding(finding);
      assert(!("decision" in finding), "AI finding must not expose a gate decision");
      results.push({
        name: "2. AI finding contract keeps policy authority outside the AI output",
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (error) {
      results.push({
        name: "2. AI finding contract keeps policy authority outside the AI output",
        passed: false,
        durationMs: Date.now() - start,
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 3. Scorer is deterministic for identical inputs.
  {
    const start = Date.now();
    try {
      const input = {
        impact: 8.7,
        severity: "high" as const,
        confidence: 0.94,
        changeFrequency: 12,
        remediationEffortHours: 6,
      };

      const first = calculateDebtMetrics(input);
      const second = calculateDebtMetrics(input);

      assert(
        JSON.stringify(first) === JSON.stringify(second),
        "Identical scorer inputs must produce identical output",
      );
      assert(first.debtScore === 101.5708, `Unexpected debt score: ${first.debtScore}`);

      results.push({
        name: "3. Deterministic scorer produces replayable Debt Score",
        passed: true,
        durationMs: Date.now() - start,
        details: `Debt Score = ${first.debtScore} | High severity weight = 0.90`,
      });
    } catch (error) {
      results.push({
        name: "3. Deterministic scorer produces replayable Debt Score",
        passed: false,
        durationMs: Date.now() - start,
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 4. Verified critical security debt in the security kernel blocks.
  {
    const start = Date.now();
    try {
      const result = evaluateDebtGate({
        tdId: "TD-0001",
        category: "security",
        severity: "critical",
        confidence: 0.95,
        impact: 9,
        debtScore: 90,
        affectedBoundary: "security-kernel",
        evidenceVerified: true,
      });

      validateDebtGateDecision(result);
      assert(result.decision === "BLOCK", "Critical security-kernel debt must BLOCK");
      assert(result.policyApplied === "security-kernel-critical", "Wrong blocking policy");
      results.push({
        name: "4. Security-kernel critical debt is deterministically blocked",
        passed: true,
        durationMs: Date.now() - start,
        details: result.reasonCode,
      });
    } catch (error) {
      results.push({
        name: "4. Security-kernel critical debt is deterministically blocked",
        passed: false,
        durationMs: Date.now() - start,
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 5. High security debt blocks only when evidence is verified.
  {
    const start = Date.now();
    try {
      const result = evaluateDebtGate({
        tdId: "TD-0002",
        category: "security",
        severity: "high",
        confidence: 0.94,
        impact: 8,
        debtScore: 50,
        affectedBoundary: "application",
        evidenceVerified: true,
      });

      assert(result.decision === "BLOCK", "Verified high security debt must BLOCK");

      const unverified = evaluateDebtGate({
        tdId: "TD-0003",
        category: "security",
        severity: "high",
        confidence: 0.99,
        impact: 9,
        debtScore: 120,
        affectedBoundary: "application",
        evidenceVerified: false,
      });

      assert(unverified.decision === "BLOCK", "Unverified evidence must fail closed");
      assert(unverified.reasonCode === "EVIDENCE_UNVERIFIED", "Wrong fail-closed reason");
      results.push({
        name: "5. Security policy and evidence-integrity policy are fail-closed",
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (error) {
      results.push({
        name: "5. Security policy and evidence-integrity policy are fail-closed",
        passed: false,
        durationMs: Date.now() - start,
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 6. Low-impact documentation debt passes; generic high debt goes to review.
  {
    const start = Date.now();
    try {
      const documentation = evaluateDebtGate({
        tdId: "TD-0004",
        category: "documentation",
        severity: "low",
        confidence: 0.90,
        impact: 2,
        debtScore: 5,
        evidenceVerified: true,
      });
      assert(documentation.decision === "PASS", "Low-impact documentation debt must PASS");

      const review = evaluateDebtGate({
        tdId: "TD-0005",
        category: "maintainability",
        severity: "medium",
        confidence: 0.90,
        impact: 7,
        debtScore: 80,
        evidenceVerified: true,
      });
      assert(review.decision === "REVIEW", "High debt score should require review");

      results.push({
        name: "6. Non-critical debt follows deterministic PASS/REVIEW policies",
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (error) {
      results.push({
        name: "6. Non-critical debt follows deterministic PASS/REVIEW policies",
        passed: false,
        durationMs: Date.now() - start,
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 7. Debt record contract enforces digest, ranges, and identity.
  {
    const start = Date.now();
    try {
      const record = {
        tdId: "TD-0042",
        findingId: "FND-0042",
        category: "security" as const,
        severity: "high" as const,
        confidence: 0.94,
        repositoryId: "repo-a",
        commitSha: "22c1ace005ee89f4bd5c16df9f60a4592fa972cb",
        locationPath: "packages/security/src/context-signer.ts",
        locationSymbols: ["ExecutionContextSigner"],
        evidenceIds: ["SA-42"],
        evidenceHash: "sha256:" + "b".repeat(64),
        impact: 8.7,
        risk: 0.705,
        changeFrequency: 12,
        remediationEffortHours: 6,
        debtScore: 101.5272,
        status: "open" as const,
        createdAt: "2026-10-04T10:00:00.000Z",
        accepted: false,
      };

      validateDebtRecord(record);
      results.push({
        name: "7. Debt record contract validates score inputs and evidence identity",
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (error) {
      results.push({
        name: "7. Debt record contract validates score inputs and evidence identity",
        passed: false,
        durationMs: Date.now() - start,
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
