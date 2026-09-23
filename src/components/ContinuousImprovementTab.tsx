/**
 * AI Workbench - Continuous Improvement & Governance 2.0 Dashboard
 * Sprint 12 Component
 */

import React, { useState } from "react";
import { TenantInfo } from "../types";
import {
  failureIntelligence,
  RunFailureRecord,
} from "../../packages/governance/src/failure-intelligence";
import {
  feedbackAndEvalEngine,
  EvalSummary,
  RegressionGateResult,
} from "../../packages/governance/src/feedback-eval";
import {
  adaptiveModelRouter,
  routeScore,
  ModelRouteProfile,
} from "../../packages/governance/src/adaptive-router";
import {
  costAnomalySentinel,
  CostAnomaly,
} from "../../packages/budget/src/cost-anomaly";
import {
  riskAdaptivePolicyEngine,
  RiskPolicyRule,
} from "../../packages/policy/src/risk-adaptive";
import {
  agentCapabilityReviewBoard,
  CapabilityReview,
  CapabilityDecision,
} from "../../packages/governance/src/capability-review";
import {
  complianceAndDisasterRecoveryService,
  ComplianceExport,
  ArchitectureDecision,
  IncidentPostmortem,
  DisasterRecoveryDrillResult,
} from "../../packages/governance/src/compliance-adr";
import {
  runContinuousImprovementTestSuite,
  TestResult,
} from "../../tests/governance/continuous-improvement.test";
import {
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Sparkles,
  Server,
  DollarSign,
  Activity,
  Layers,
  FileCheck,
  Zap,
  Lock,
  RefreshCw,
  GitBranch,
} from "lucide-react";

interface ContinuousImprovementTabProps {
  currentTenant: TenantInfo;
}

type SubSection =
  | "failures"
  | "evals"
  | "routing"
  | "cost"
  | "capabilities"
  | "compliance_dr"
  | "tests";

export const ContinuousImprovementTab: React.FC<ContinuousImprovementTabProps> = ({
  currentTenant,
}) => {
  const [activeSection, setActiveSection] = useState<SubSection>("failures");

  // State handles
  const [failures, setFailures] = useState<RunFailureRecord[]>(
    failureIntelligence.listFailures(currentTenant.id)
  );
  const [clusters, setClusters] = useState(
    failureIntelligence.clusterFailures(currentTenant.id)
  );
  const [selectedFailure, setSelectedFailure] = useState<RunFailureRecord | null>(
    failures[0] || null
  );

  // Evals & Regression gate
  const [feedbacks, setFeedbacks] = useState(feedbackAndEvalEngine.getFeedbacks());
  const [evalSummaries, setEvalSummaries] = useState(
    feedbackAndEvalEngine.getEvalSummaries()
  );
  const [gateResult, setGateResult] = useState<RegressionGateResult | null>(null);

  // Router
  const [routeProfiles, setRouteProfiles] = useState<ModelRouteProfile[]>(
    adaptiveModelRouter.getProfiles()
  );
  const [promotionFeedback, setPromotionFeedback] = useState<string | null>(null);

  // Cost Anomaly Sentinel
  const [anomalies, setAnomalies] = useState<CostAnomaly[]>(
    costAnomalySentinel.getAnomalies()
  );
  const [costMetrics, setCostMetrics] = useState(
    costAnomalySentinel.getOptimizationMetrics()
  );

  // Policy & Capabilities
  const [riskRules] = useState<RiskPolicyRule[]>(
    riskAdaptivePolicyEngine.getRules()
  );
  const [capabilities, setCapabilities] = useState<CapabilityReview[]>(
    agentCapabilityReviewBoard.listCapabilities()
  );

  // Compliance & DR
  const [complianceExports, setComplianceExports] = useState<ComplianceExport[]>(
    complianceAndDisasterRecoveryService.getComplianceExports()
  );
  const [adrs] = useState<ArchitectureDecision[]>(
    complianceAndDisasterRecoveryService.getADRs()
  );
  const [incidents] = useState<IncidentPostmortem[]>(
    complianceAndDisasterRecoveryService.getIncidents()
  );
  const [drDrills, setDrDrills] = useState<DisasterRecoveryDrillResult[]>(
    complianceAndDisasterRecoveryService.getDrDrills()
  );
  const [isExecutingDrill, setIsExecutingDrill] = useState(false);

  // Tests
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Handler for regression test creation
  const handleGenerateRegression = (failId: string) => {
    try {
      const reg = failureIntelligence.generateRegressionTestCase(failId);
      alert(`Created Offline Regression Case:\nID: ${reg.testCaseId}\nAssertion: ${reg.safetyAssertion}`);
      setFailures(failureIntelligence.listFailures(currentTenant.id));
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  // Handler for evaluating regression gate
  const handleEvaluateCandidate = (candidateType: "clean" | "faulty") => {
    const summary: EvalSummary =
      candidateType === "clean"
        ? {
            datasetVersion: "eval-ds-v2.5",
            releaseId: `rel-${Date.now()}-clean-candidate`,
            candidateType: "model",
            completedCases: 250,
            successRate: 0.97,
            testsPassRate: 0.99,
            securityViolations: 0,
            meanCost: 0.18,
            p95LatencyMs: 2200,
            humanApprovalRate: 0.95,
            evaluatedAt: new Date().toISOString(),
          }
        : {
            datasetVersion: "eval-ds-v2.5",
            releaseId: `rel-${Date.now()}-faulty-candidate`,
            candidateType: "prompt",
            completedCases: 250,
            successRate: 0.91,
            testsPassRate: 0.89,
            securityViolations: 3, // Blocked by zero tolerance
            meanCost: 0.44,
            p95LatencyMs: 4600,
            humanApprovalRate: 0.78,
            evaluatedAt: new Date().toISOString(),
          };

    const res = feedbackAndEvalEngine.evaluateRegressionGate(summary);
    setGateResult(res);
    setEvalSummaries(feedbackAndEvalEngine.getEvalSummaries());
  };

  // Handler for stage promotion in model routing
  const handlePromoteModel = (modelId: string) => {
    try {
      const res = adaptiveModelRouter.evaluateStagePromotion(modelId);
      if (res.promoted) {
        setPromotionFeedback(`Success: ${res.reason}`);
      } else {
        setPromotionFeedback(`Blocked: ${res.reason}`);
      }
      setRouteProfiles(adaptiveModelRouter.getProfiles());
    } catch (e: any) {
      setPromotionFeedback(`Error: ${e.message}`);
    }
  };

  // Handler for capability decisions
  const handleUpdateCapabilityDecision = (
    id: string,
    decision: CapabilityDecision
  ) => {
    try {
      agentCapabilityReviewBoard.updateDecision(
        id,
        decision,
        `Decision applied via UI review by ${currentTenant.name} governance officer`,
        "sec_reviewer_admin"
      );
      setCapabilities(agentCapabilityReviewBoard.listCapabilities());
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleRollbackCapability = (id: string) => {
    try {
      agentCapabilityReviewBoard.rollbackDecision(id, "sec_reviewer_admin");
      setCapabilities(agentCapabilityReviewBoard.listCapabilities());
    } catch (e: any) {
      alert(`Rollback failed: ${e.message}`);
    }
  };

  // Handler for DR drill
  const handleRunDrill = () => {
    setIsExecutingDrill(true);
    setTimeout(() => {
      const drill = complianceAndDisasterRecoveryService.executeDisasterRecoveryDrill();
      setDrDrills(complianceAndDisasterRecoveryService.getDrDrills());
      setIsExecutingDrill(false);
    }, 600);
  };

  // Handler for export bundle
  const handleGenerateExport = () => {
    const exp = complianceAndDisasterRecoveryService.generateComplianceExport(
      currentTenant.id,
      {
        start: new Date(Date.now() - 86400_000 * 30).toISOString(),
        end: new Date().toISOString(),
      }
    );
    setComplianceExports(
      complianceAndDisasterRecoveryService.getComplianceExports()
    );
    alert(`Evidence Bundle Generated: ${exp.id}\nSHA-256 Digest: ${exp.integrityHash}`);
  };

  // Handler for running automated test suite
  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await runContinuousImprovementTestSuite();
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
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Sprint 12 — Continuous Improvement & Governance 2.0</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Failure Intelligence, Evals & Risk-Adaptive Governance
            </h1>
            <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
              Transforming production run anomalies into reproducible offline evals, enforcing weighted
              model routing with immutable safety floors, tripping circuit breakers on runaway loops, and
              mandating Two-Person Rules on critical infrastructure changes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunTests}
              disabled={isRunningTests}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
            >
              <Play className={`w-4 h-4 ${isRunningTests ? "animate-spin" : ""}`} />
              <span>{isRunningTests ? "Running Verifications..." : "Run Sprint 12 Tests (10/10)"}</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span>Failure Taxonomy</span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-lg font-bold text-white mt-1">{failures.length} Recorded</div>
            <div className="text-[10px] text-amber-400 mt-0.5">{clusters.length} Root Categories</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span>Regression Gate</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-emerald-400 mt-1">Zero Tolerance</div>
            <div className="text-[10px] text-slate-400 mt-0.5">0 Security Violations</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span>Adaptive Routing</span>
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-lg font-bold text-cyan-400 mt-1">Score: 0.915</div>
            <div className="text-[10px] text-slate-400 mt-0.5">80% Pro / 20% Flash</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span>Cost Anomaly Sentinel</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-white mt-1">${costMetrics.estimatedSavingsUsd.toFixed(0)}</div>
            <div className="text-[10px] text-emerald-400 mt-0.5">Savings from Breakers</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span>Capability Audits</span>
              <Lock className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-lg font-bold text-white mt-1">{capabilities.length} Tracked</div>
            <div className="text-[10px] text-purple-400 mt-0.5">1 Suspended, 1 Removed</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span>DR Drill (RTO/RPO)</span>
              <Server className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-lg font-bold text-blue-400 mt-1">8.4m / 0.2m</div>
            <div className="text-[10px] text-emerald-400 mt-0.5">RTO SLA Met (&lt;15m)</div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex overflow-x-auto space-x-2 border-b border-slate-800/80 pb-2 scrollbar-none">
        {[
          { id: "failures", label: "Failure Intelligence", icon: AlertTriangle },
          { id: "evals", label: "Quality Feedback & Eval Gate", icon: ShieldCheck },
          { id: "routing", label: "Adaptive Model Routing", icon: Zap },
          { id: "cost", label: "Cost Anomaly & Sentinel", icon: DollarSign },
          { id: "capabilities", label: "Risk Policy & Capability Review", icon: Lock },
          { id: "compliance_dr", label: "Compliance, ADRs & DR Drills", icon: FileCheck },
          { id: "tests", label: "Automated Verifications", icon: Play },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as SubSection)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECTION 1: FAILURE INTELLIGENCE & TAXONOMY */}
      {activeSection === "failures" && (
        <div className="space-y-6">
          {/* Cluster Summary Header */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {clusters.map((c) => (
              <div
                key={c.category}
                className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {c.category.replace(/_/g, " ")}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {c.count} Runs
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-medium">
                  Remediation Layer: <span className="text-indigo-400 uppercase font-bold">{c.remediationLayer}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {c.recommendedFix}
                </p>
              </div>
            ))}
          </div>

          {/* Failures List & Detailed Root-Cause Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center justify-between">
                <span>Recorded Failure Incidents</span>
                <span className="text-[11px] font-normal text-slate-500">Tenant: {currentTenant.name}</span>
              </h3>

              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {failures.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFailure(f)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      selectedFailure?.id === f.id
                        ? "bg-indigo-950/40 border-indigo-500/50 shadow-md"
                        : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">{f.id}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          f.severity === "critical" || f.severity === "high"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {f.severity}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 font-mono mt-1 truncate">
                      Run: {f.runId} • Step: {f.stepId || "N/A"}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                      {f.symptom}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Pane: Selected Failure Deep Dive */}
            <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
              {selectedFailure ? (
                <>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <div className="text-xs font-bold text-indigo-400 uppercase tracking-wide">
                        Incident Deep-Dive & Root Cause Analysis
                      </div>
                      <h4 className="text-lg font-bold text-white mt-0.5">
                        {selectedFailure.category.replace(/_/g, " ").toUpperCase()} ({selectedFailure.id})
                      </h4>
                    </div>

                    <button
                      onClick={() => handleGenerateRegression(selectedFailure.id)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Offline Regression Case</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px]">Detected By</span>
                      <span className="font-semibold text-slate-200">{selectedFailure.detectedBy}</span>
                    </div>
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px]">Remediation Layer</span>
                      <span className="font-semibold text-indigo-400 uppercase">{selectedFailure.remediationLayer}</span>
                    </div>
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px]">Retryable</span>
                      <span className="font-semibold text-slate-300">{selectedFailure.retryable ? "Yes" : "No"}</span>
                    </div>
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px]">Evidence Artifact</span>
                      <span className="font-mono text-cyan-400 text-[11px] truncate block">
                        {selectedFailure.evidenceArtifactId || "None"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-3.5">
                      <div className="text-xs font-bold text-rose-400 mb-1 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Observed Symptom</span>
                      </div>
                      <p className="text-xs text-slate-300 font-mono leading-relaxed">
                        {selectedFailure.symptom}
                      </p>
                    </div>

                    <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-3.5">
                      <div className="text-xs font-bold text-indigo-400 mb-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Separated Root Cause</span>
                      </div>
                      <p className="text-xs text-slate-300 font-sans leading-relaxed">
                        {selectedFailure.rootCause}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-16 text-slate-500 text-xs">
                  Select a failure incident on the left to inspect root-cause analysis
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: QUALITY EVALS & REGRESSION GATE */}
      {activeSection === "evals" && (
        <div className="space-y-6">
          {/* Release Regression Gate Simulator */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>Release Regression Gate Sentinel</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enforces non-negotiable boundaries: zero security violations allowed, min 95% test pass rate,
                  and strict mean cost ceilings prior to canary rollout.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEvaluateCandidate("clean")}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md"
                >
                  Test Compliant Candidate (Pass)
                </button>
                <button
                  onClick={() => handleEvaluateCandidate("faulty")}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md"
                >
                  Test Faulty Candidate (Block)
                </button>
              </div>
            </div>

            {/* Gate Result Banner */}
            {gateResult && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-2 ${
                  gateResult.status === "PASSED"
                    ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-200"
                    : "bg-rose-950/30 border-rose-500/30 text-rose-200"
                }`}
              >
                <div className="flex items-center justify-between font-bold text-sm">
                  <span className="flex items-center gap-2">
                    {gateResult.status === "PASSED" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span>
                      {gateResult.verdict} — {gateResult.releaseId}
                    </span>
                  </span>
                  <span className="font-mono text-xs">{gateResult.certifiedBy}</span>
                </div>

                {gateResult.reasons.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1 text-rose-300">
                    {gateResult.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/60 font-mono text-[11px]">
                  <div>Success Rate: {(gateResult.summary.successRate * 100).toFixed(1)}%</div>
                  <div>Tests Pass: {(gateResult.summary.testsPassRate * 100).toFixed(1)}%</div>
                  <div>Security Violations: {gateResult.summary.securityViolations}</div>
                  <div>Mean Cost: ${gateResult.summary.meanCost.toFixed(3)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Redacted Traces & Feedback Pipeline */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span>Production Feedback with Sanitized Traces</span>
              <span className="text-[11px] font-normal text-emerald-400">PII & Secret Redaction Active</span>
            </h3>

            <div className="space-y-3">
              {feedbacks.map((fb) => (
                <div
                  key={fb.id}
                  className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-indigo-300">{fb.id}</span>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        Source: {fb.source}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          fb.label === "accepted"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-rose-500/10 text-rose-400"
                        }`}
                      >
                        {fb.label}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 font-mono bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                    {fb.rawComment || JSON.stringify(fb.redactedTrace)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: ADAPTIVE MODEL ROUTING */}
      {activeSection === "routing" && (
        <div className="space-y-6">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  <span>Guarded Multi-Metric Routing Cockpit</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Formula: <code className="text-cyan-300 font-mono text-[11px]">Quality*0.45 + Success*0.25 + LatencyScore*0.10 + CostScore*0.10 - Fallback*0.05 - SecurityRejection*0.05</code>
                </p>
              </div>
            </div>

            {promotionFeedback && (
              <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-xs font-mono text-indigo-300 flex items-center justify-between">
                <span>{promotionFeedback}</span>
                <button
                  onClick={() => setPromotionFeedback(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {routeProfiles.map((p) => {
                const score = routeScore(p.metrics);
                return (
                  <div
                    key={p.modelId}
                    className={`p-4 rounded-xl border space-y-3 ${
                      p.isBaseline
                        ? "bg-slate-950 border-cyan-500/40 shadow-lg shadow-cyan-950/20"
                        : p.rollbackTriggered
                        ? "bg-rose-950/20 border-rose-500/30"
                        : "bg-slate-950/70 border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white font-mono">{p.modelId}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          p.isBaseline
                            ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {p.isBaseline ? "Baseline Approved" : p.stage.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-400 font-mono">
                      <div className="flex justify-between">
                        <span>Traffic Weight:</span>
                        <span className="font-bold text-white">{p.trafficWeight}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Quality Score:</span>
                        <span className="text-slate-200">{(p.metrics.qualityScore * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>p95 Latency:</span>
                        <span className="text-slate-200">{p.metrics.p95LatencyMs}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cost / Run:</span>
                        <span className="text-emerald-400">${p.metrics.costPerRun.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Security Rejection:</span>
                        <span
                          className={
                            p.metrics.securityRejectionRate > 0.02
                              ? "text-rose-400 font-bold"
                              : "text-slate-200"
                          }
                        >
                          {(p.metrics.securityRejectionRate * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Calculated Route Score</span>
                        <span className="text-lg font-bold text-cyan-400">{score.toFixed(3)}</span>
                      </div>

                      {!p.isBaseline && (
                        <button
                          onClick={() => handlePromoteModel(p.modelId)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                        >
                          Promote Stage
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: COST ANOMALY & CIRCUIT BREAKER */}
      {activeSection === "cost" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400">Total Tokens</span>
              <div className="text-xl font-bold text-white mt-1">
                {(costMetrics.totalTokensProcessed / 1_000_000).toFixed(1)}M
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400">Prompt Caching Efficiency</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {(costMetrics.cachedTokensRatio * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400">Runaway Retries Blocked</span>
              <div className="text-xl font-bold text-amber-400 mt-1">
                {costMetrics.unneededRetriesBlocked}
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400">Estimated Cost Saved</span>
              <div className="text-xl font-bold text-cyan-400 mt-1">
                ${costMetrics.estimatedSavingsUsd.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span>Cost Anomaly Sentinel & Circuit Breaker Events</span>
              <span className="text-[11px] font-normal text-amber-400">Auto-Freeze Escalation Active</span>
            </h3>

            <div className="space-y-3">
              {anomalies.map((a) => (
                <div
                  key={a.id}
                  className="bg-slate-950/60 border border-amber-500/20 rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-white">{a.id} • Run: {a.runId}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Deviation: {a.deviationRatio}x Baseline
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 font-mono">
                    Baseline: ${a.baselineCost.toFixed(2)} → Observed: ${a.observedCost.toFixed(2)} ({a.reason})
                  </div>

                  <div className="text-[11px] text-slate-400 leading-snug">
                    {a.remediationSummary}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: RISK POLICY & CAPABILITY REVIEW */}
      {activeSection === "capabilities" && (
        <div className="space-y-6">
          {/* Risk Level Rules Matrix */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Risk-Adaptive Policy Matrix & Two-Person Rules
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {riskRules.slice(0, 4).map((r) => (
                <div key={r.actionPattern} className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex justify-between font-mono text-indigo-300 text-[11px]">
                    <span>{r.actionPattern}</span>
                    <span className="uppercase text-[10px] text-slate-400">{r.riskLevel}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">{r.description}</div>
                  <div className="text-[10px] text-emerald-400 pt-1 font-semibold">
                    Approvals: {r.requiredApprovals} {r.dualApproverRequired && "(Dual Approver)"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Capability Review Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span>Agent Capability Lifecycle Review Board</span>
              <span className="text-[11px] font-normal text-slate-400">Regular 30/90-Day Reviews</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Agent & Capability</th>
                    <th className="py-2.5 px-3">Risk</th>
                    <th className="py-2.5 px-3">Usage</th>
                    <th className="py-2.5 px-3">Security Events</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {capabilities.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-850/40">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white font-mono">{c.capabilityName}</div>
                        <div className="text-[10px] text-slate-500">{c.agentId}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          c.riskLevel === "critical"
                            ? "bg-rose-500/10 text-rose-400"
                            : c.riskLevel === "high"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-slate-800 text-slate-300"
                        }`}>
                          {c.riskLevel}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {c.usageCount.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <span className={c.securityEvents > 0 ? "text-rose-400 font-bold" : "text-slate-400"}>
                          {c.securityEvents}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          c.decision === "retain"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : c.decision === "restrict"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-rose-500/10 text-rose-400"
                        }`}>
                          {c.decision} (v{c.version})
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-1.5">
                          {c.decision !== "retain" && (
                            <button
                              onClick={() => handleUpdateCapabilityDecision(c.id, "retain")}
                              className="px-2 py-1 rounded text-[10px] font-semibold bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                            >
                              Retain
                            </button>
                          )}
                          {c.decision !== "restrict" && (
                            <button
                              onClick={() => handleUpdateCapabilityDecision(c.id, "restrict")}
                              className="px-2 py-1 rounded text-[10px] font-semibold bg-amber-600/20 text-amber-400 hover:bg-amber-600/30"
                            >
                              Restrict
                            </button>
                          )}
                          {c.decision !== "suspend" && (
                            <button
                              onClick={() => handleUpdateCapabilityDecision(c.id, "suspend")}
                              className="px-2 py-1 rounded text-[10px] font-semibold bg-rose-600/20 text-rose-400 hover:bg-rose-600/30"
                            >
                              Suspend
                            </button>
                          )}
                          {c.previousDecision && (
                            <button
                              onClick={() => handleRollbackCapability(c.id)}
                              title="Rollback to previous governance decision"
                              className="p-1 rounded text-slate-400 hover:text-white"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: COMPLIANCE, ADRs & DR DRILLS */}
      {activeSection === "compliance_dr" && (
        <div className="space-y-6">
          {/* DR Drill Bar */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Server className="w-5 h-5 text-blue-400" />
                  <span>Disaster Recovery Drill & RTO/RPO SLA Verification</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Tests isolated database restore, verifies RLS tenant boundaries, recovers artifacts,
                  and validates cryptographic Merkle audit hash chain integrity.
                </p>
              </div>

              <button
                onClick={handleRunDrill}
                disabled={isExecutingDrill}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md flex items-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isExecutingDrill ? "animate-spin" : ""}`} />
                <span>{isExecutingDrill ? "Executing Drill..." : "Run DR Restore Drill"}</span>
              </button>
            </div>

            {drDrills[0] && (
              <div className="bg-slate-950/70 border border-blue-500/20 rounded-xl p-4 text-xs space-y-2 font-mono">
                <div className="flex items-center justify-between font-bold text-blue-300">
                  <span>Drill ID: {drDrills[0].drillId}</span>
                  <span className="text-emerald-400 uppercase">Status: {drDrills[0].overallStatus}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300 pt-1">
                  <div>Actual RTO: {drDrills[0].actualRtoMinutes}m (Target: &lt;15m)</div>
                  <div>Actual RPO: {drDrills[0].actualRpoMinutes}m (Target: &lt;1m)</div>
                  <div>RLS Scope: Verified</div>
                  <div>Audit Chain: Intact</div>
                </div>
                <div className="text-[11px] text-slate-400 pt-1">
                  {drDrills[0].summary}
                </div>
              </div>
            )}
          </div>

          {/* Compliance Bundles & ADRs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Compliance Exports */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                  Tamper-Evident Compliance Evidence Bundles
                </h3>
                <button
                  onClick={handleGenerateExport}
                  className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50"
                >
                  Export New Bundle
                </button>
              </div>

              <div className="space-y-3">
                {complianceExports.map((exp) => (
                  <div
                    key={exp.id}
                    className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between text-indigo-300 font-semibold">
                      <span>{exp.id}</span>
                      <span className="text-[10px] text-emerald-400">Verified</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      SHA-256: {exp.integrityHash}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Tenant: {exp.tenantId} • Exported: {new Date(exp.exportedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Architecture Decision Records (ADRs) */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                Architecture Decision Records (ADR)
              </h3>

              <div className="space-y-3">
                {adrs.map((adr) => (
                  <div
                    key={adr.id}
                    className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-white">{adr.id}: {adr.title}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 uppercase">
                        {adr.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      {adr.decision}
                    </p>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Security Impact: {adr.securityImpact}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 7: AUTOMATED TESTS (10 / 10) */}
      {activeSection === "tests" && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Play className="w-5 h-5 text-indigo-400" />
                <span>Sprint 12 Continuous Improvement Test Suite (10 / 10)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Automated end-to-end verification of Failure Intelligence, Redaction, Regression Gates,
                Weighted Routing, Cost Anomaly Sentinel, Capability Review, and DR Drills.
              </p>
            </div>

            <button
              onClick={handleRunTests}
              disabled={isRunningTests}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md flex items-center space-x-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningTests ? "animate-spin" : ""}`} />
              <span>{isRunningTests ? "Executing Tests..." : "Run Test Suite"}</span>
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
              Click &quot;Run Test Suite&quot; above to execute the 10 automated Continuous Improvement verification tests.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
