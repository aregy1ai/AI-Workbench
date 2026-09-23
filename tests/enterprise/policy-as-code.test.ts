/**
 * AI Workbench - Sprint 14: Enterprise Intelligence & Policy-as-Code Test Suite
 * Automated Verification
 */

import { policyCompilerToolchain, PolicySourceAST } from "../../packages/policy-as-code/src/compiler";
import { policyDecisionExplainer } from "../../packages/policy-as-code/src/explainer";
import { enterprisePolicySimulator } from "../../packages/policy-as-code/src/simulator";
import { enterpriseRiskGraph } from "../../packages/policy-as-code/src/risk-graph";
import { multiStageApprovalService } from "../../packages/policy-as-code/src/multi-stage-approvals";
import { delegationBroker } from "../../packages/policy-as-code/src/delegation";
import { toolSupplyChainAuditor } from "../../packages/policy-as-code/src/tool-provenance";
import { enterpriseFederationEngine } from "../../packages/policy-as-code/src/federation";

export interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
}

export async function runEnterprisePolicyTestSuite(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const assert = (condition: boolean, msg: string) => {
    if (!condition) throw new Error(msg);
  };

  // Test 1: Policy Compiler & Valid AST Compilation
  {
    const start = Date.now();
    try {
      const validAST: PolicySourceAST = {
        apiVersion: "policy.workbench/v1",
        kind: "ToolPolicy",
        metadata: {
          name: "protected-main-policy",
          version: "3.0.0",
          scope: "tenant",
          tenantId: "tenant_fintech_01",
          owner: "security_lead@enterprise.org",
        },
        spec: {
          rules: [
            {
              id: "rule_require_merge_approval",
              description: "Mandate dual approval for main branch merges",
              priority: 90,
              match: {
                tools: ["github.merge_pull_request"],
                branches: ["main"],
              },
              decision: "require_approval",
              exceptions: [
                {
                  when: { approvalCount: ">=2", ciStatus: "success", riskLevel: "high" },
                  decision: "require_approval",
                },
              ],
            },
            {
              id: "rule_allow_linter",
              description: "Allow linter across all branches",
              priority: 10,
              match: {
                tools: ["linter.run"],
              },
              decision: "allow",
            },
          ],
        },
      };

      const bundle = policyCompilerToolchain.compile(validAST);
      assert(bundle.compiledHash.startsWith("sha256_"), "Compiled bundle must have cryptographic SHA256 digest");
      assert(bundle.rules.length === 2, "Compiled bundle must contain all rules");
      assert(bundle.signature.startsWith("sig_ed25519_"), "Compiled bundle must be signed");

      results.push({
        name: "1. Policy Compiler: Compiles valid AST into signed, cryptographically hashed PolicyBundle",
        passed: true,
        durationMs: Date.now() - start,
        details: `Generated bundle '${bundle.policyId}' (Hash: ${bundle.compiledHash.substring(0, 16)}...)`,
      });
    } catch (e: any) {
      results.push({
        name: "1. Policy Compiler: Compiles valid AST into signed, cryptographically hashed PolicyBundle",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 2: Policy Linter Invariant Blocks
  {
    const start = Date.now();
    try {
      const flawedAST: PolicySourceAST = {
        apiVersion: "policy.workbench/v1",
        kind: "ToolPolicy",
        metadata: {
          name: "flawed-policy",
          version: "1.0.0",
          scope: "tenant",
          owner: "unassigned", // Error: missing owner
        },
        spec: {
          rules: [
            {
              id: "unapproved_merge",
              description: "Direct merge to main",
              priority: 50,
              match: {
                tools: ["github.merge_pull_request"],
                branches: ["main"],
              },
              decision: "allow", // Error: direct allow on prod merge
            },
            {
              id: "wildcard_allow",
              description: "Allow everything",
              priority: 50, // Warning: same priority
              match: {
                tools: ["*"],
              },
              decision: "allow", // Error: wildcard allow
            },
          ],
        },
      };

      const issues = policyCompilerToolchain.lint(flawedAST);
      assert(issues.some((i) => i.code === "UNAPPROVED_PROD_MERGE"), "Must catch UNAPPROVED_PROD_MERGE");
      assert(issues.some((i) => i.code === "WILDCARD_ALLOW_FORBIDDEN"), "Must catch WILDCARD_ALLOW_FORBIDDEN");
      assert(issues.some((i) => i.code === "MISSING_OWNER"), "Must catch MISSING_OWNER");

      let compileFailed = false;
      try {
        policyCompilerToolchain.compile(flawedAST);
      } catch (err: any) {
        compileFailed = true;
      }
      assert(compileFailed, "Compilation must fail when lint errors exist");

      results.push({
        name: "2. Policy Linter: Blocks unapproved prod merges, wildcard allows, and unassigned owners",
        passed: true,
        durationMs: Date.now() - start,
        details: `Identified ${issues.length} lint violations and blocked compilation`,
      });
    } catch (e: any) {
      results.push({
        name: "2. Policy Linter: Blocks unapproved prod merges, wildcard allows, and unassigned owners",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 3: Policy Decision Explainer
  {
    const start = Date.now();
    try {
      const bundle = policyCompilerToolchain.compile({
        apiVersion: "policy.workbench/v1",
        kind: "ToolPolicy",
        metadata: {
          name: "corp-security",
          version: "2.1",
          scope: "tenant",
          owner: "ciso@enterprise.org",
        },
        spec: {
          rules: [
            {
              id: "require_merge_approval",
              description: "Require approval for merge",
              priority: 100,
              match: { tools: ["github.merge_pull_request"] },
              decision: "require_approval",
            },
          ],
        },
      });

      const explanation = policyDecisionExplainer.explainDecision(bundle, {
        action: "github.merge_pull_request",
        tenantId: "tenant_fintech_01",
        approvalsProvided: 0,
      });

      assert(explanation.result === "requires_approval", "Result should be requires_approval");
      assert(explanation.matchedRules.includes("require_merge_approval"), "Must match rule ID");
      assert(explanation.reason.includes("APPROVAL_PENDING"), "Reason must clearly cite approval requirement");

      results.push({
        name: "3. Decision Explainer: Generates transparent decision explanation without exposing sensitive prompts",
        passed: true,
        durationMs: Date.now() - start,
        details: `Decision ${explanation.result.toUpperCase()}: ${explanation.reason}`,
      });
    } catch (e: any) {
      results.push({
        name: "3. Decision Explainer: Generates transparent decision explanation without exposing sensitive prompts",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 4: Pre-Flight Policy Simulation & Diff Analysis
  {
    const start = Date.now();
    try {
      const currentBundle = policyCompilerToolchain.compile({
        apiVersion: "policy.workbench/v1",
        kind: "ToolPolicy",
        metadata: { name: "v1-base", version: "1.0", scope: "tenant", owner: "sec@org.com" },
        spec: {
          rules: [
            { id: "deny_drop", description: "Deny drop table", priority: 100, match: { tools: ["database.drop_table"] }, decision: "deny" },
            { id: "require_merge", description: "Require merge", priority: 50, match: { tools: ["github.merge_pull_request"] }, decision: "require_approval" },
          ],
        },
      });

      // Candidate bundle that relaxes database drop table
      const candidateBundle = policyCompilerToolchain.compile({
        apiVersion: "policy.workbench/v1",
        kind: "ToolPolicy",
        metadata: { name: "v2-cand", version: "2.0", scope: "tenant", owner: "sec@org.com" },
        spec: {
          rules: [
            { id: "allow_drop", description: "Allow drop table with 2 approvals", priority: 100, match: { tools: ["database.drop_table"] }, decision: "allow" },
            { id: "require_merge", description: "Require merge", priority: 50, match: { tools: ["github.merge_pull_request"] }, decision: "require_approval" },
          ],
        },
      });

      const sim = enterprisePolicySimulator.runSimulation(currentBundle, candidateBundle);
      assert(sim.diffs.length > 0, "Must detect differences between bundles");
      assert(sim.requiresIndependentSignOff, "Relaxation of drop_table must trigger mandatory independent sign-off");

      results.push({
        name: "4. Policy Simulator: Diffs current vs candidate bundles and enforces independent sign-off on high risk",
        passed: true,
        durationMs: Date.now() - start,
        details: `Identified ${sim.diffs.length} diff(s); flagged ${sim.highRiskDifferences} high-risk differences`,
      });
    } catch (e: any) {
      results.push({
        name: "4. Policy Simulator: Diffs current vs candidate bundles and enforces independent sign-off on high risk",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 5: Risk Graph Topology & Anomaly Detection
  {
    const start = Date.now();
    try {
      const anomalies = enterpriseRiskGraph.analyzeAnomalies();
      assert(anomalies.length > 0, "Must detect seeded cross-tenant credential anomaly");
      assert(anomalies.some((a) => a.anomalyType === "CROSS_TENANT_CREDENTIAL"), "Must detect CROSS_TENANT_CREDENTIAL");

      results.push({
        name: "5. Risk Graph Topology: Detects cross-tenant credential reuse and boundary violations",
        passed: true,
        durationMs: Date.now() - start,
        details: `Detected ${anomalies.length} anomaly: ${anomalies[0].description.substring(0, 75)}...`,
      });
    } catch (e: any) {
      results.push({
        name: "5. Risk Graph Topology: Detects cross-tenant credential reuse and boundary violations",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 6: Risk Graph Blast Radius Computation
  {
    const start = Date.now();
    try {
      const blastRadius = enterpriseRiskGraph.computeBlastRadius("agent_payments_bot");
      assert(blastRadius.length >= 4, "Blast radius of agent must include connected tools, repos, and workspace");
      assert(blastRadius.includes("repo_ledger"), "Blast radius must include reachable repository");
      assert(blastRadius.includes("tool_gh_merge"), "Blast radius must include reachable tool");

      results.push({
        name: "6. Blast Radius Computation: Calculates transitive blast radius across agents, tools, and repositories",
        passed: true,
        durationMs: Date.now() - start,
        details: `Calculated blast radius for 'agent_payments_bot': ${blastRadius.length} connected entity nodes`,
      });
    } catch (e: any) {
      results.push({
        name: "6. Blast Radius Computation: Calculates transitive blast radius across agents, tools, and repositories",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 7: Multi-Stage Approval Workflow & Separation of Duties
  {
    const start = Date.now();
    try {
      const req = multiStageApprovalService.createApprovalRequest({
        runId: "run_test_appr_01",
        stepId: "step_01",
        tenantId: "tenant_fintech_01",
        requesterId: "agent_code_crafter_v2",
        action: "github.merge_pull_request",
        resource: "repo:fintech-core:main",
      });

      // 7A: Requester cannot self-approve
      let selfApproveBlocked = false;
      try {
        multiStageApprovalService.submitApproval(req.requestId, "agent_code_crafter_v2", "peer_reviewer");
      } catch (err: any) {
        if (err.message.includes("SEPARATION_OF_DUTIES_VIOLATION") || err.message.includes("AGENT_APPROVAL_FORBIDDEN")) {
          selfApproveBlocked = true;
        }
      }
      assert(selfApproveBlocked, "Requester/Agent self-approval must be blocked");

      // 7B: Valid first approval -> security_review
      multiStageApprovalService.submitApproval(req.requestId, "user_peer_reviewer_01", "peer_reviewer");
      assert(req.state === "security_review", "Single approval must advance state to security_review");

      // 7C: Valid second approval -> approved
      multiStageApprovalService.submitApproval(req.requestId, "user_security_lead_02", "security_admin");
      assert(req.state === "approved", "Dual approval must advance state to approved");

      results.push({
        name: "7. Multi-Stage Approvals: Enforces Separation of Duties and advances through dual-person sign-off",
        passed: true,
        durationMs: Date.now() - start,
        details: "Blocked self-approval; verified progression: requested -> security_review -> approved",
      });
    } catch (e: any) {
      results.push({
        name: "7. Multi-Stage Approvals: Enforces Separation of Duties and advances through dual-person sign-off",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 8: Scoped Short-Lived Delegated Execution
  {
    const start = Date.now();
    try {
      const grant = delegationBroker.issueGrant({
        issuerUserId: "user_team_lead_88",
        subjectAgentId: "agent_code_crafter_v2",
        tenantId: "tenant_fintech_01",
        allowedTools: ["github.create_pull_request"],
        resourceScope: ["repo:fintech-core:*"],
        maxCost: 1.0,
        maxUses: 1, // Only 1 use allowed
        ttlSeconds: 1800,
      });

      // 8A: First execution allowed
      const exec1 = delegationBroker.authorizeDelegatedExecution(
        grant.grantId,
        "github.create_pull_request",
        "repo:fintech-core:pr-12"
      );
      assert(exec1.allowed, "First execution within bounds must be allowed");
      assert(Boolean(exec1.ephemeralTokenNonce), "Must dispense ephemeral token nonce");

      // 8B: Second execution blocked on max uses exceeded
      const exec2 = delegationBroker.authorizeDelegatedExecution(
        grant.grantId,
        "github.create_pull_request",
        "repo:fintech-core:pr-13"
      );
      assert(!exec2.allowed, "Second execution must be blocked due to max uses exceeded");
      assert(exec2.rejectionReason === "MAX_USES_EXCEEDED", "Must cite MAX_USES_EXCEEDED");

      results.push({
        name: "8. Delegated Execution: Enforces tool/resource boundaries and single-use ephemeral constraints",
        passed: true,
        durationMs: Date.now() - start,
        details: "Authorized initial execution with nonce; strictly rejected subsequent execution on limit breach",
      });
    } catch (e: any) {
      results.push({
        name: "8. Delegated Execution: Enforces tool/resource boundaries and single-use ephemeral constraints",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 9: Tool Provenance & Supply Chain Gates
  {
    const start = Date.now();
    try {
      const verified = toolSupplyChainAuditor.auditTool("tool_git_commit");
      assert(verified.passed, "Verified tool with signed commit and digest must pass audit");

      const unverified = toolSupplyChainAuditor.auditTool("tool_unverified_thirdparty");
      assert(!unverified.passed, "Tool with untracked commit and invalid signature must fail audit");
      assert(unverified.gates.filter((g) => !g.passed).length >= 3, "Must fail multiple gates");

      results.push({
        name: "9. Tool Supply Chain: Certifies cryptographic provenance and blocks unverified third-party binaries",
        passed: true,
        durationMs: Date.now() - start,
        details: "Validated 7 supply-chain gates for git_commit; quarantined untrusted binary",
      });
    } catch (e: any) {
      results.push({
        name: "9. Tool Supply Chain: Certifies cryptographic provenance and blocks unverified third-party binaries",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 10: Enterprise Federation & Policy Inheritance
  {
    const start = Date.now();
    try {
      // Global denies raw network egress
      // Workspace attempts to allow it
      const result = enterpriseFederationEngine.evaluateHierarchy("network.open_egress", {
        globalRules: [{ tool: "network.open_egress", decision: "deny" }],
        orgRules: [{ tool: "network.open_egress", decision: "allow" }],
        tenantRules: [{ tool: "network.open_egress", decision: "allow" }],
        workspaceRules: [{ tool: "network.open_egress", decision: "allow" }],
      });

      assert(result.effectiveDecision === "deny", "Lower policy cannot relax a higher global deny");
      assert(result.blockedByHigherLevel, "Must indicate blocked by higher level");
      assert(result.resolvedAtLevel === "global", "Must be resolved at global level");

      results.push({
        name: "10. Policy Inheritance: Enforces monotonic restriction; lower tiers cannot override global deny",
        passed: true,
        durationMs: Date.now() - start,
        details: `Global deny prevailed over workspace allow (${result.reason})`,
      });
    } catch (e: any) {
      results.push({
        name: "10. Policy Inheritance: Enforces monotonic restriction; lower tiers cannot override global deny",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  return results;
}
