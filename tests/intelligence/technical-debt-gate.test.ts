/** Eagle TDI v1 - deterministic contract, scoring, policy, and authority tests. */
import {
  calculateDebtMetrics,
  evaluateDebtGate,
  validateDebtGateDecision,
  validateDebtRecord,
  validateEvidence,
  validateFinding,
} from "../../packages/intelligence/src/technical-debt";

const sha = "sha256:" + "a".repeat(64);
const commit = "22c1ace005ee89f4bd5c16df9f60a4592fa972cb";

export interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

function facts(overrides: Record<string, unknown> = {}) {
  return {
    evidenceVerified: true,
    provenanceVerified: true,
    contractValid: true,
    affectedBoundary: "application" as const,
    category: "security" as const,
    securityRuleMatched: true,
    trustedSeverity: "high" as const,
    classificationSource: "trusted-tool" as const,
    ...overrides,
  };
}

export function runTechnicalDebtGateTestSuite(): TestResult[] {
  const results: TestResult[] = [];
  const test = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({
        name,
        passed: false,
        details: error instanceof Error ? error.message : String(error),
      });
    }
  };

  test("Evidence contract validates SHA-256 and pinned commit", () => {
    const evidence = {
      id: "SA-1",
      type: "static_analysis" as const,
      tenantId: "tenant-a",
      workspaceId: "workspace-a",
      repositoryId: "repo-a",
      commitSha: commit,
      source: "unit-test",
      path: "packages/security/src/context-signer.ts",
      collectedAt: "2026-10-04T10:00:00.000Z",
      contentDigest: sha,
      data: { finding: "example" },
    };
    validateEvidence(evidence);
    let rejected = false;
    try {
      validateEvidence({ ...evidence, contentDigest: "sha256_fake" });
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("malformed digest accepted");
  });

  test("Finding has no policy decision and requires evidence", () => {
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
    if ("decision" in finding) throw new Error("AI finding exposed policy decision");
  });

  test("Scoring is deterministic and policy-versioned", () => {
    const input = {
      impact: 8.7,
      severity: "high" as const,
      confidence: 0.94,
      changeFrequency: 12,
      remediationEffortHours: 6,
    };
    const first = calculateDebtMetrics(input);
    const second = calculateDebtMetrics(input);
    if (JSON.stringify(first) !== JSON.stringify(second)) {
      throw new Error("score is not reproducible");
    }
    if (first.debtScore !== 101.5708) {
      throw new Error("unexpected score " + first.debtScore);
    }
    if (first.scoringPolicyVersion !== "tdi-score-v1.0") {
      throw new Error("missing scoring policy version");
    }
  });

  test("Trusted critical security-kernel classification blocks", () => {
    const result = evaluateDebtGate({
      tdId: "TD-0001",
      confidence: 0.95,
      impact: 9,
      debtScore: 90,
      policyFacts: facts({
        affectedBoundary: "security-kernel",
        trustedSeverity: "critical",
      }),
    });
    validateDebtGateDecision(result);
    if (result.decision !== "BLOCK") {
      throw new Error("critical security-kernel debt did not block");
    }
  });

  test("AI severity alone cannot create BLOCK", () => {
    const result = evaluateDebtGate({
      tdId: "TD-0002",
      confidence: 0.99,
      impact: 9,
      debtScore: 120,
      policyFacts: facts({
        trustedSeverity: undefined,
        classificationSource: "ai",
      }),
    });
    if (result.decision === "BLOCK") {
      throw new Error("AI-only classification created BLOCK");
    }
  });

  test("Evidence/provenance failure fails closed", () => {
    const result = evaluateDebtGate({
      tdId: "TD-0003",
      confidence: 0.99,
      impact: 9,
      debtScore: 120,
      policyFacts: facts({
        evidenceVerified: false,
        provenanceVerified: false,
      }),
    });
    if (result.decision !== "BLOCK") {
      throw new Error("integrity failure did not fail closed");
    }
    if (result.reasonCode !== "EVIDENCE_OR_PROVENANCE_UNVERIFIED") {
      throw new Error("wrong integrity reason");
    }
  });

  test("Low-impact documentation debt passes deterministically", () => {
    const result = evaluateDebtGate({
      tdId: "TD-0004",
      confidence: 0.90,
      impact: 2,
      debtScore: 5,
      policyFacts: facts({
        category: "documentation",
        securityRuleMatched: false,
        trustedSeverity: "low",
        classificationSource: "deterministic-policy",
      }),
    });
    if (result.decision !== "PASS") {
      throw new Error("documentation debt did not pass");
    }
  });

  test("High debt score requires human review", () => {
    const result = evaluateDebtGate({
      tdId: "TD-0005",
      confidence: 0.90,
      impact: 7,
      debtScore: 80,
      policyFacts: facts({
        category: "maintainability",
        securityRuleMatched: false,
        trustedSeverity: "medium",
      }),
    });
    if (result.decision !== "REVIEW") {
      throw new Error("high debt did not require review");
    }
  });

  test("Decision fingerprint is real SHA-256 and replay-stable", () => {
    const input = {
      tdId: "TD-0006",
      confidence: 0.90,
      impact: 7,
      debtScore: 80,
      policyFacts: facts({
        category: "maintainability",
        securityRuleMatched: false,
        trustedSeverity: "medium",
      }),
    };
    const first = evaluateDebtGate(input);
    const second = evaluateDebtGate(input);
    if (first.decisionFingerprint !== second.decisionFingerprint) {
      throw new Error("decision fingerprint is not replay-stable");
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(first.decisionFingerprint)) {
      throw new Error("decision fingerprint is not SHA-256");
    }
  });

  test("Debt Record contract enforces identity, ranges, and digest", () => {
    validateDebtRecord({
      tdId: "TD-0042",
      findingId: "FND-0042",
      category: "security",
      severity: "high",
      confidence: 0.94,
      repositoryId: "repo-a",
      commitSha: commit,
      locationPath: "packages/security/src/context-signer.ts",
      locationSymbols: ["ExecutionContextSigner"],
      evidenceIds: ["SA-42"],
      evidenceHash: sha,
      impact: 8.7,
      risk: 0.846,
      changeFrequency: 12,
      remediationEffortHours: 6,
      debtScore: 101.5708,
      status: "open",
      createdAt: "2026-10-04T10:00:00.000Z",
      accepted: false,
    });
  });

  return results;
}
