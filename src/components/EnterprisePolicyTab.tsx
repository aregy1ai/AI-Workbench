/**
 * AI Workbench - Enterprise Intelligence & Policy-as-Code Dashboard
 * Sprint 14 Component
 */

import React, { useState } from "react";
import { TenantInfo } from "../types";
import {
  policyCompilerToolchain,
  PolicySourceAST,
  PolicyBundle,
  PolicyLintIssue,
} from "../../packages/policy-as-code/src/compiler";
import {
  policyDecisionExplainer,
  PolicyDecisionExplanation,
} from "../../packages/policy-as-code/src/explainer";
import {
  enterprisePolicySimulator,
  PreFlightSimulationSummary,
} from "../../packages/policy-as-code/src/simulator";
import {
  enterpriseRiskGraph,
  RiskNode,
  RiskEdge,
  RiskAnomaly,
} from "../../packages/policy-as-code/src/risk-graph";
import {
  multiStageApprovalService,
  ApprovalRecord,
} from "../../packages/policy-as-code/src/multi-stage-approvals";
import {
  delegationBroker,
  DelegationGrant,
} from "../../packages/policy-as-code/src/delegation";
import {
  toolSupplyChainAuditor,
  ToolProvenance,
  SupplyChainGateResult,
} from "../../packages/policy-as-code/src/tool-provenance";
import {
  enterpriseFederationEngine,
  HierarchyDecisionResult,
} from "../../packages/policy-as-code/src/federation";
import {
  enterpriseComplianceService,
  ComplianceFinding,
  ComplianceSummary,
} from "../../packages/policy-as-code/src/compliance-dashboard";
import {
  runEnterprisePolicyTestSuite,
  TestResult,
} from "../../tests/enterprise/policy-as-code.test";
import {
  ShieldAlert,
  Code2,
  FileCheck2,
  GitBranch,
  Layers,
  Key,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Lock,
  Cpu,
  RefreshCw,
  FolderTree,
  Award,
  Fingerprint,
} from "lucide-react";

interface EnterprisePolicyTabProps {
  currentTenant: TenantInfo;
}

type SubSection =
  | "compiler"
  | "explainer"
  | "simulation"
  | "risk_graph"
  | "approvals"
  | "delegation"
  | "supply_chain"
  | "federation"
  | "compliance"
  | "tests";

export const EnterprisePolicyTab: React.FC<EnterprisePolicyTabProps> = ({
  currentTenant,
}) => {
  const [activeSection, setActiveSection] = useState<SubSection>("compiler");

  // Compiler State
  const [samplePolicyYAML, setSamplePolicyYAML] = useState<string>(`apiVersion: policy.workbench/v1
kind: ToolPolicy
metadata:
  name: protected-main-v3
  version: "3.2.0"
  scope: tenant
  tenantId: "${currentTenant.id}"
  owner: "sec-governance@enterprise.org"
spec:
  rules:
    - id: rule_protect_main_merge
      description: Mandate dual approval for main branch merges
      priority: 95
      match:
        tools: ["github.merge_pull_request"]
        branches: ["main"]
      decision: require_approval
      exceptions:
        - when:
            approvalCount: ">=2"
            ciStatus: success
            riskLevel: high
          decision: require_approval
    - id: rule_allow_linter_and_test
      description: Auto-allow test and lint tools
      priority: 20
      match:
        tools: ["linter.run", "test.execute"]
      decision: allow`);

  const [activeBundle, setActiveBundle] = useState<PolicyBundle>(() => {
    return policyCompilerToolchain.compile({
      apiVersion: "policy.workbench/v1",
      kind: "ToolPolicy",
      metadata: {
        name: "protected-main-v3",
        version: "3.2.0",
        scope: "tenant",
        tenantId: currentTenant.id,
        owner: "sec-governance@enterprise.org",
      },
      spec: {
        rules: [
          {
            id: "rule_protect_main_merge",
            description: "Mandate dual approval for main branch merges",
            priority: 95,
            match: { tools: ["github.merge_pull_request"], branches: ["main"] },
            decision: "require_approval",
          },
          {
            id: "rule_allow_linter_and_test",
            description: "Auto-allow test and lint tools",
            priority: 20,
            match: { tools: ["linter.run", "test.execute"] },
            decision: "allow",
          },
        ],
      },
    });
  });

  const [lintIssues, setLintIssues] = useState<PolicyLintIssue[]>([]);

  // Explainer State
  const [queryAction, setQueryAction] = useState("github.merge_pull_request");
  const [queryApprovals, setQueryApprovals] = useState(1);
  const [currentExplanation, setCurrentExplanation] = useState<PolicyDecisionExplanation | null>(() => {
    return policyDecisionExplainer.explainDecision(activeBundle, {
      action: "github.merge_pull_request",
      tenantId: currentTenant.id,
      approvalsProvided: 1,
    });
  });

  // Simulator State
  const [simulationResult, setSimulationResult] = useState<PreFlightSimulationSummary | null>(null);

  // Risk Graph State
  const [graphData] = useState<{ nodes: RiskNode[]; edges: RiskEdge[] }>(
    enterpriseRiskGraph.getGraphData()
  );
  const [riskAnomalies] = useState<RiskAnomaly[]>(enterpriseRiskGraph.analyzeAnomalies());
  const [selectedNodeId, setSelectedNodeId] = useState<string>("agent_payments_bot");
  const [computedBlastRadius, setComputedBlastRadius] = useState<string[]>(() =>
    enterpriseRiskGraph.computeBlastRadius("agent_payments_bot")
  );

  // Approvals State
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRecord[]>(
    multiStageApprovalService.getRequests()
  );

  // Delegation State
  const [grants, setGrants] = useState<DelegationGrant[]>(delegationBroker.getGrants());
  const [delegationTestOutput, setDelegationTestOutput] = useState<string | null>(null);

  // Supply Chain State
  const [provenanceList] = useState<ToolProvenance[]>(toolSupplyChainAuditor.getRegistry());
  const [auditedTools, setAuditedTools] = useState<Record<string, SupplyChainGateResult>>(() => {
    return {
      tool_git_commit: toolSupplyChainAuditor.auditTool("tool_git_commit"),
      tool_unverified_thirdparty: toolSupplyChainAuditor.auditTool("tool_unverified_thirdparty"),
    };
  });

  // Federation State
  const [hierarchyResult, setHierarchyResult] = useState<HierarchyDecisionResult | null>(() => {
    return enterpriseFederationEngine.evaluateHierarchy("network.open_egress", {
      globalRules: [{ tool: "network.open_egress", decision: "deny" }],
      orgRules: [{ tool: "network.open_egress", decision: "allow" }],
      tenantRules: [{ tool: "network.open_egress", decision: "allow" }],
      workspaceRules: [{ tool: "network.open_egress", decision: "allow" }],
    });
  });

  // Compliance State
  const [complianceFindings, setComplianceFindings] = useState<ComplianceFinding[]>(
    enterpriseComplianceService.getFindings()
  );
  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary>(
    enterpriseComplianceService.getSummary()
  );

  // Automated Tests
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Handlers
  const handleLintAndCompile = () => {
    try {
      const ast: PolicySourceAST = {
        apiVersion: "policy.workbench/v1",
        kind: "ToolPolicy",
        metadata: {
          name: "protected-main-v3",
          version: "3.2.0",
          scope: "tenant",
          tenantId: currentTenant.id,
          owner: "sec-governance@enterprise.org",
        },
        spec: {
          rules: [
            {
              id: "rule_protect_main_merge",
              description: "Mandate dual approval for main branch merges",
              priority: 95,
              match: { tools: ["github.merge_pull_request"], branches: ["main"] },
              decision: "require_approval",
            },
            {
              id: "rule_allow_linter_and_test",
              description: "Auto-allow test and lint tools",
              priority: 20,
              match: { tools: ["linter.run", "test.execute"] },
              decision: "allow",
            },
          ],
        },
      };

      const issues = policyCompilerToolchain.lint(ast);
      setLintIssues(issues);

      const bundle = policyCompilerToolchain.compile(ast);
      setActiveBundle(bundle);
      alert(`Policy Compiled & Signed Successfully!\nBundle Hash: ${bundle.compiledHash}\nSignature: ${bundle.signature}`);
    } catch (e: any) {
      alert(`Compilation Failed: ${e.message}`);
    }
  };

  const handleExplainDecision = () => {
    const res = policyDecisionExplainer.explainDecision(activeBundle, {
      action: queryAction,
      tenantId: currentTenant.id,
      approvalsProvided: queryApprovals,
    });
    setCurrentExplanation(res);
  };

  const handleRunSimulation = (candidateType: "compliant" | "relaxed") => {
    const candidateBundle = policyCompilerToolchain.compile({
      apiVersion: "policy.workbench/v1",
      kind: "ToolPolicy",
      metadata: {
        name: `candidate-${candidateType}`,
        version: "4.0.0",
        scope: "tenant",
        owner: "ciso-office@enterprise.org",
      },
      spec: {
        rules:
          candidateType === "compliant"
            ? [
                {
                  id: "rule_protect_main_merge",
                  description: "Dual approval required",
                  priority: 100,
                  match: { tools: ["github.merge_pull_request"] },
                  decision: "require_approval",
                },
                {
                  id: "rule_deny_drop",
                  description: "Deny database drop",
                  priority: 90,
                  match: { tools: ["database.drop_table"] },
                  decision: "deny",
                },
              ]
            : [
                {
                  id: "rule_allow_main_merge",
                  description: "Relaxed main merge",
                  priority: 100,
                  match: { tools: ["github.merge_pull_request"] },
                  decision: "allow", // RELAXED!
                },
              ],
      },
    });

    const sim = enterprisePolicySimulator.runSimulation(activeBundle, candidateBundle);
    setSimulationResult(sim);
  };

  const handleSelectRiskNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setComputedBlastRadius(enterpriseRiskGraph.computeBlastRadius(nodeId));
  };

  const handleCastApproval = (requestId: string, role: "security_admin" | "workspace_owner" | "peer_reviewer") => {
    try {
      const updated = multiStageApprovalService.submitApproval(requestId, `user_${role}_99`, role);
      setApprovalRequests(multiStageApprovalService.getRequests());
      alert(`Approval Recorded!\nState: ${updated.state}\nTotal Approvals: ${updated.approvalsCollected.length}`);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleTestDelegatedExecution = (grantId: string) => {
    const res = delegationBroker.authorizeDelegatedExecution(
      grantId,
      "github.create_pull_request",
      "repo:fintech-core:pr-45"
    );
    setGrants(delegationBroker.getGrants());
    setDelegationTestOutput(
      res.allowed
        ? `EXECUTION AUTHORIZED: Ephemeral Nonce Dispensed: ${res.ephemeralTokenNonce}`
        : `EXECUTION REJECTED: ${res.rejectionReason}`
    );
  };

  const handleRemediateCompliance = (findingId: string) => {
    enterpriseComplianceService.remediateFinding(findingId, "security_lead_ui");
    setComplianceFindings(enterpriseComplianceService.getFindings());
    setComplianceSummary(enterpriseComplianceService.getSummary());
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await runEnterprisePolicyTestSuite();
      setTestResults(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunningTests(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Top Banner / Headline */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-purple-500/20 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
              <Code2 className="w-3.5 h-3.5" />
              <span>Sprint 14 — Enterprise Intelligence & Policy-as-Code</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Policy-as-Code, Risk Graph & Enterprise Governance
            </h1>
            <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
              Transforming scattered security rules into a fully programmable, typed, linted, and cryptographically signed
              policy toolchain. Enforcing multi-stage human approvals, ephemeral delegated execution, and supply-chain provenance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunTests}
              disabled={isRunningTests}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25 transition-all disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${isRunningTests ? "animate-spin" : ""}`} />
              <span>{isRunningTests ? "Verifying..." : "Run Sprint 14 Tests (10/10)"}</span>
            </button>
          </div>
        </div>

        {/* Enterprise Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-6 pt-5 border-t border-slate-800/80 font-mono">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">Signed Bundle</div>
            <div className="text-sm font-bold text-purple-400 mt-0.5 truncate">{activeBundle.version}</div>
            <div className="text-[9px] text-slate-500 truncate">{activeBundle.compiledHash.substring(0, 14)}...</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">Risk Graph Entities</div>
            <div className="text-base font-bold text-cyan-400 mt-0.5">{graphData.nodes.length} Nodes</div>
            <div className="text-[9px] text-slate-500">{graphData.edges.length} Edges Mapped</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">Topology Anomalies</div>
            <div className={`text-base font-bold mt-0.5 ${riskAnomalies.length > 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {riskAnomalies.length} Critical
            </div>
            <div className="text-[9px] text-slate-500">Cross-Tenant Isolation</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">Pending Approvals</div>
            <div className="text-base font-bold text-amber-400 mt-0.5">{approvalRequests.length} Active</div>
            <div className="text-[9px] text-slate-500">Dual-Sign-off Gated</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">Delegated Grants</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">{grants.length} Scoped</div>
            <div className="text-[9px] text-slate-500">Ephemeral Token TTL</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">Open Findings</div>
            <div className="text-base font-bold text-rose-400 mt-0.5">{complianceSummary.openCount} Open</div>
            <div className="text-[9px] text-slate-500">{complianceSummary.criticalCount} Critical / {complianceSummary.highCount} High</div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex overflow-x-auto space-x-2 border-b border-slate-800/80 pb-2 scrollbar-none">
        {[
          { id: "compiler", label: "Policy Compiler & Linter", icon: Code2 },
          { id: "explainer", label: "Decision Explainer", icon: FileCheck2 },
          { id: "simulation", label: "Pre-Flight Simulator", icon: GitBranch },
          { id: "risk_graph", label: "Enterprise Risk Graph", icon: FolderTree },
          { id: "approvals", label: "Multi-Stage Approvals", icon: Users },
          { id: "delegation", label: "Delegated Execution", icon: Key },
          { id: "supply_chain", label: "Tool Provenance", icon: Award },
          { id: "federation", label: "Policy Inheritance", icon: Layers },
          { id: "compliance", label: "Compliance Dashboard", icon: ShieldAlert },
          { id: "tests", label: "Sprint 14 Verifications", icon: Play },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as SubSection)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECTION 1: POLICY-AS-CODE COMPILER & LINTER */}
      {activeSection === "compiler" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <Code2 className="w-4 h-4 text-purple-400" />
                <span>Policy Source Specification (YAML / AST)</span>
              </h3>
              <button
                onClick={handleLintAndCompile}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md"
              >
                Lint & Compile Bundle
              </button>
            </div>

            <textarea
              value={samplePolicyYAML}
              onChange={(e) => setSamplePolicyYAML(e.target.value)}
              rows={16}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 font-mono text-xs text-purple-200 focus:outline-none focus:border-purple-500/50 resize-none"
            />

            {lintIssues.length > 0 && (
              <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg text-xs space-y-1">
                <div className="font-bold text-amber-400">Lint Issues Detected:</div>
                {lintIssues.map((issue, idx) => (
                  <div key={idx} className="text-amber-300 font-mono text-[11px]">
                    [{issue.code}] {issue.message}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span>Signed Policy Bundle Inspector</span>
              <span className="text-emerald-400 font-mono text-[11px]">Cryptographically Signed</span>
            </h3>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-purple-300">
                <span>Policy ID: {activeBundle.policyId}</span>
                <span>v{activeBundle.version}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Compiled Hash: <span className="text-emerald-400">{activeBundle.compiledHash}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Signature: <span className="text-cyan-400">{activeBundle.signature}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Scope: <span className="text-white uppercase">{activeBundle.scope}</span>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="text-[10px] uppercase font-bold text-slate-500">Compiled Rules ({activeBundle.rules.length}):</div>
                {activeBundle.rules.map((r, idx) => (
                  <div key={idx} className="p-2 bg-slate-900/60 border border-slate-800 rounded text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{r.ruleId}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        r.decision === "allow" ? "bg-emerald-500/10 text-emerald-400" :
                        r.decision === "require_approval" ? "bg-amber-500/10 text-amber-400" :
                        "bg-rose-500/10 text-rose-400"
                      }`}>
                        {r.decision}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[10px]">
                      Tool: <span className="text-indigo-300">{r.toolPattern}</span> • Priority: {r.priority} • Approvals: {r.requiredApprovals}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: POLICY DECISION EXPLAINER */}
      {activeSection === "explainer" && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-purple-400" />
                <span>Transparent Decision Explainer & Scope Redaction</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Every authorization decision provides full rule-lineage and explicit reasons while redacting raw prompt text.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                value={queryAction}
                onChange={(e) => setQueryAction(e.target.value)}
                placeholder="Requested Action (e.g. github.merge_pull_request)"
                className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-purple-500/50 w-64"
              />
              <select
                value={queryApprovals}
                onChange={(e) => setQueryApprovals(Number(e.target.value))}
                className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono text-white focus:outline-none"
              >
                <option value={0}>0 Approvals</option>
                <option value={1}>1 Approval</option>
                <option value={2}>2 Approvals (Dual)</option>
              </select>
              <button
                onClick={handleExplainDecision}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white"
              >
                Evaluate Decision
              </button>
            </div>
          </div>

          {currentExplanation && (
            <div className={`p-4 rounded-xl border font-mono text-xs space-y-3 ${
              currentExplanation.result === "allow"
                ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                : currentExplanation.result === "requires_approval"
                ? "bg-amber-950/20 border-amber-500/30 text-amber-200"
                : "bg-rose-950/20 border-rose-500/30 text-rose-200"
            }`}>
              <div className="flex items-center justify-between font-bold text-sm">
                <span className="uppercase">Result: {currentExplanation.result}</span>
                <span className="text-[11px] text-slate-400 font-normal">{currentExplanation.decisionId}</span>
              </div>

              <div className="text-white font-sans text-xs">
                Reason: {currentExplanation.reason}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                <div>Matched Rules: {currentExplanation.matchedRules.join(", ") || "None"}</div>
                <div>Risk Level: <span className="uppercase font-bold">{currentExplanation.riskLevel}</span></div>
                <div>Approvals Needed: {currentExplanation.requiredApprovals}</div>
                <div>Policy Version: {currentExplanation.policyVersion}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: PRE-FLIGHT POLICY SIMULATOR */}
      {activeSection === "simulation" && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-indigo-400" />
                <span>Pre-Flight Policy Diff & Simulation Engine</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Compares Current vs Candidate policy bundles across production benchmark scenarios prior to deployment.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRunSimulation("compliant")}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md"
              >
                Simulate Hardened Policy (Safe)
              </button>
              <button
                onClick={() => handleRunSimulation("relaxed")}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md"
              >
                Simulate Relaxed Policy (Flag High Risk)
              </button>
            </div>
          </div>

          {simulationResult && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border text-xs font-mono space-y-2 ${
                simulationResult.canDeploySafely
                  ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                  : "bg-rose-950/20 border-rose-500/30 text-rose-200"
              }`}>
                <div className="flex items-center justify-between font-bold text-sm">
                  <span>
                    {simulationResult.canDeploySafely
                      ? "PRE-FLIGHT SIMULATION PASSED — CAN DEPLOY"
                      : "DEPLOYMENT BLOCKED — INDEPENDENT SIGN-OFF REQUIRED"}
                  </span>
                  <span className="text-xs text-slate-400">{simulationResult.simulationId}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-slate-300">
                  <div>Evaluations: {simulationResult.totalEvaluations}</div>
                  <div>Newly Allowed: {simulationResult.newlyAllowed}</div>
                  <div>Newly Denied: {simulationResult.newlyDenied}</div>
                  <div>High Risk Diffs: {simulationResult.highRiskDifferences}</div>
                </div>
              </div>

              {simulationResult.diffs.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detected Policy Diffs:</div>
                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
                    {simulationResult.diffs.map((d, idx) => (
                      <div key={idx} className="p-3 bg-slate-950/60 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white">{d.action}</div>
                          <div className="text-[10px] text-slate-500">{d.resource}</div>
                        </div>
                        <div className="flex items-center space-x-2 text-[11px]">
                          <span className="text-slate-400">{d.currentDecision}</span>
                          <ArrowRight className="w-3 h-3 text-slate-500" />
                          <span className="font-bold text-purple-400">{d.candidateDecision}</span>
                          <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {d.risk}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: ENTERPRISE RISK GRAPH */}
      {activeSection === "risk_graph" && (
        <div className="space-y-6">
          {/* Anomaly Alert */}
          {riskAnomalies.length > 0 && (
            <div className="p-4 bg-rose-950/20 border border-rose-500/40 rounded-xl text-xs space-y-1">
              <div className="flex items-center space-x-2 font-bold text-rose-400">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Critical Risk Graph Topology Anomaly Detected!</span>
              </div>
              <p className="text-rose-300 leading-snug">{riskAnomalies[0].description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Graph Node Selector */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                Risk Topology Entities ({graphData.nodes.length})
              </h3>
              <div className="space-y-2 overflow-y-auto max-h-96 pr-1 font-mono text-xs">
                {graphData.nodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => handleSelectRiskNode(node.id)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                      selectedNodeId === node.id
                        ? "bg-purple-950/40 border-purple-500/50 text-white"
                        : "bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-850"
                    }`}
                  >
                    <div>
                      <div className="font-bold">{node.label}</div>
                      <div className="text-[10px] text-slate-500">{node.id}</div>
                    </div>
                    <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700">
                      {node.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Blast Radius Details */}
            <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                  Transitive Blast Radius Analyzer
                </h3>
                <span className="text-xs text-purple-400 font-mono">
                  Reachable: {computedBlastRadius.length} Nodes
                </span>
              </div>

              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs space-y-2 font-mono">
                <div className="text-slate-400">
                  Target Entity: <span className="font-bold text-white">{selectedNodeId}</span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Transitive Blast Reachability:
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {computedBlastRadius.map((entityId) => (
                    <span
                      key={entityId}
                      className="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-purple-500/30 text-purple-300"
                    >
                      {entityId}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Topology Relations:</div>
                <div className="space-y-1.5 font-mono text-[11px] max-h-56 overflow-y-auto pr-1">
                  {graphData.edges
                    .filter((e) => e.sourceId === selectedNodeId || e.targetId === selectedNodeId)
                    .map((edge, idx) => (
                      <div key={idx} className="p-2 bg-slate-950/40 border border-slate-800/80 rounded flex items-center justify-between">
                        <span>{edge.sourceId}</span>
                        <span className="text-purple-400 font-bold uppercase text-[9px] px-1.5 py-0.5 bg-purple-950/30 rounded">
                          {edge.relation}
                        </span>
                        <span>{edge.targetId}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: MULTI-STAGE APPROVAL WORKFLOW */}
      {activeSection === "approvals" && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                Multi-Stage Dual-Sign-Off Approval Queue
              </h3>
              <span className="text-xs text-amber-400 font-mono">Separation of Duties Active</span>
            </div>

            <div className="space-y-4">
              {approvalRequests.map((req) => (
                <div
                  key={req.requestId}
                  className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-5 space-y-3 font-mono text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white text-sm">{req.requestId}</span>
                      <span className="text-slate-500 ml-2">· {req.action}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      req.state === "approved" ? "bg-emerald-500/10 text-emerald-400" :
                      req.state === "rejected" ? "bg-rose-500/10 text-rose-400" :
                      "bg-amber-500/10 text-amber-400"
                    }`}>
                      {req.state}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Resource: <span className="text-purple-300">{req.resource}</span> • Requester: {req.requesterId}
                  </div>

                  {/* Stepper */}
                  <div className="grid grid-cols-4 gap-2 pt-2 text-[10px] text-center font-bold">
                    <div className="p-1.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">1. Requested</div>
                    <div className="p-1.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">2. Risk Assessed</div>
                    <div className={`p-1.5 rounded border ${req.approvalsCollected.length >= 1 ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30" : "bg-slate-900 text-slate-500 border-slate-800"}`}>
                      3. Peer Review
                    </div>
                    <div className={`p-1.5 rounded border ${req.approvalsCollected.length >= 2 ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30" : "bg-slate-900 text-slate-500 border-slate-800"}`}>
                      4. Security Sign-off
                    </div>
                  </div>

                  {req.state !== "approved" && req.state !== "rejected" && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => handleCastApproval(req.requestId, "peer_reviewer")}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
                      >
                        Sign as Peer Reviewer
                      </button>
                      <button
                        onClick={() => handleCastApproval(req.requestId, "security_admin")}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white"
                      >
                        Sign as Security Lead
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: DELEGATED EXECUTION */}
      {activeSection === "delegation" && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Scoped Short-Lived Delegated Grants
            </h3>

            <div className="space-y-3 font-mono text-xs">
              {grants.map((g) => (
                <div key={g.grantId} className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-white font-bold">
                    <span>{g.grantId}</span>
                    <span className="text-emerald-400">Uses: {g.currentUses} / {g.maxUses}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Subject: <span className="text-cyan-300">{g.subjectAgentId}</span> • Issuer: {g.issuerUserId}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Allowed Tools: {g.allowedTools.join(", ")}
                  </div>
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleTestDelegatedExecution(g.grantId)}
                      className="px-3 py-1 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      Authorize Execution Step
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {delegationTestOutput && (
              <div className="p-3 bg-slate-950 border border-purple-500/30 rounded-lg text-xs font-mono text-purple-300">
                {delegationTestOutput}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 7: TOOL SUPPLY CHAIN PROVENANCE */}
      {activeSection === "supply_chain" && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Tool Supply Chain Provenance & Verification Gates
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {provenanceList.map((tool) => {
                const audit = auditedTools[tool.toolName];
                return (
                  <div key={tool.toolName} className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between font-bold text-white">
                      <span>{tool.toolName} (v{tool.version})</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                        audit?.passed ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                      }`}>
                        {audit?.passed ? "Supply Chain Certified" : "Audit Quarantined"}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 space-y-0.5">
                      <div>Commit: <span className="text-slate-300 truncate">{tool.sourceCommit.substring(0, 16)}...</span></div>
                      <div>Digest: <span className="text-slate-300 truncate">{tool.imageDigest.substring(0, 24)}...</span></div>
                      <div>Signature: <span className="text-cyan-400">{tool.signature}</span></div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 space-y-1">
                      <div className="text-[10px] uppercase font-bold text-slate-500">Compliance Gates:</div>
                      {audit?.gates.map((g, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">{g.name}</span>
                          <span className={g.passed ? "text-emerald-400" : "text-rose-400"}>
                            {g.passed ? "✓ Passed" : "✗ Failed"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 8: ORGANIZATION POLICY INHERITANCE */}
      {activeSection === "federation" && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Cascading Policy Inheritance & Monotonic Restriction
            </h3>

            {hierarchyResult && (
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-white">Action: network.open_egress</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 uppercase">
                    Effective: {hierarchyResult.effectiveDecision}
                  </span>
                </div>

                <div className="text-slate-300 font-sans text-xs">
                  {hierarchyResult.reason}
                </div>

                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-[10px] text-center">
                  <div className="p-2 rounded bg-rose-950/30 border border-rose-500/40 text-rose-300">
                    <div className="font-bold">Global Tier</div>
                    <div className="text-[9px]">DENY (Prevails)</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    <div className="font-bold">Org Tier</div>
                    <div className="text-[9px]">ALLOW</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    <div className="font-bold">Tenant Tier</div>
                    <div className="text-[9px]">ALLOW</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    <div className="font-bold">Workspace Tier</div>
                    <div className="text-[9px]">ALLOW</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 9: REAL-TIME COMPLIANCE DASHBOARD */}
      {activeSection === "compliance" && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Real-Time Enterprise Compliance Findings
            </h3>

            <div className="space-y-3 font-mono text-xs">
              {complianceFindings.map((f) => (
                <div
                  key={f.findingId}
                  className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    f.status === "remediated"
                      ? "bg-slate-950/40 border-slate-800 text-slate-400"
                      : f.severity === "critical"
                      ? "bg-rose-950/20 border-rose-500/30 text-rose-200"
                      : "bg-slate-950/80 border-slate-800 text-slate-200"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white">{f.findingId}</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-purple-400">{f.control}</span>
                      <span className="text-slate-500">·</span>
                      <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                        {f.severity}
                      </span>
                    </div>
                    <div className="text-[11px] font-sans text-slate-300">{f.description}</div>
                    <div className="text-[10px] text-slate-500">Scope: {f.scope} • Owner: {f.owner}</div>
                  </div>

                  {f.status !== "remediated" ? (
                    <button
                      onClick={() => handleRemediateCompliance(f.findingId)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
                    >
                      Remediate Control
                    </button>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      REMEDIATED
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 10: SPRINT 14 AUTOMATED TESTS (10/10) */}
      {activeSection === "tests" && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Play className="w-5 h-5 text-purple-400" />
                <span>Sprint 14 Enterprise Intelligence & Policy-as-Code Test Suite (10 / 10)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Automated verification of Policy Compiler, Linter Invariants, Decision Explainer, Pre-Flight Simulation,
                Risk Graph Topology & Blast Radius, Multi-Stage Approvals, Delegated Execution, Supply-Chain Provenance, and Policy Inheritance.
              </p>
            </div>

            <button
              onClick={handleRunTests}
              disabled={isRunningTests}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md flex items-center space-x-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningTests ? "animate-spin" : ""}`} />
              <span>{isRunningTests ? "Executing..." : "Run Test Suite"}</span>
            </button>
          </div>

          {testResults ? (
            <div className="space-y-2.5">
              {testResults.map((t, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                    t.passed
                      ? "bg-slate-950/60 border-emerald-500/20 text-slate-200"
                      : "bg-rose-950/20 border-rose-500/30 text-rose-200"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {t.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-semibold text-white">{t.name}</div>
                      {t.details && (
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {t.details}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 font-mono text-[11px] text-slate-500">
                    <span>{t.durationMs}ms</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        t.passed
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {t.passed ? "PASSED" : "FAILED"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">
              Click &quot;Run Test Suite&quot; above to execute the 10 automated Enterprise Policy-as-Code verification tests.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
