/**
 * AI Workbench - Platform Intelligence & Autonomous Operations Dashboard
 * Sprint 13 Component
 */

import React, { useState } from "react";
import { TenantInfo } from "../types";
import {
  guardedAutonomousController,
  AutonomousExecutionCycle,
  OperationalSLOs,
} from "../../packages/intelligence/src/autonomous-controller";
import {
  failureDiagnosisEngine,
  DiagnosisResult,
} from "../../packages/intelligence/src/diagnosis-engine";
import {
  predictiveCapacityForecaster,
  CapacityForecast,
  ScalingActionPlan,
} from "../../packages/intelligence/src/capacity-forecaster";
import {
  costAwareExecutionOptimizer,
} from "../../packages/intelligence/src/cost-aware-execution";
import {
  policySimulator,
  PolicySimulation,
} from "../../packages/policy/src/simulator";
import {
  automatedCanaryAnalyzer,
  CanaryDecision,
} from "../../packages/intelligence/src/canary-analyzer";
import {
  automatedRunRecoveryService,
  RecoveryAssessment,
} from "../../packages/intelligence/src/run-recovery";
import {
  sandboxHygieneController,
  SandboxHygieneResult,
} from "../../packages/sandbox/src/hygiene";
import {
  lifecycleAutomationManager,
  AgentLifecycleProfile,
  ToolVerificationManifest,
} from "../../packages/intelligence/src/lifecycle-automation";
import {
  ACTION_CATALOG,
} from "../../packages/intelligence/src/action-classification";
import {
  runAutonomousOperationsTestSuite,
  TestResult,
} from "../../tests/autonomous/autonomous-operations.test";
import {
  Bot,
  ShieldCheck,
  AlertTriangle,
  Zap,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Play,
  Server,
  DollarSign,
  Activity,
  Layers,
  FileCheck,
  Lock,
  RefreshCw,
  Sliders,
  Power,
  TrendingUp,
  Cpu,
  Check,
  X,
  Clock,
  Radio,
} from "lucide-react";

interface AutonomousOperationsTabProps {
  currentTenant: TenantInfo;
}

type SubSection =
  | "controller"
  | "diagnosis"
  | "capacity"
  | "policy_simulation"
  | "canary"
  | "recovery_hygiene"
  | "lifecycle"
  | "tests";

export const AutonomousOperationsTab: React.FC<AutonomousOperationsTabProps> = ({
  currentTenant,
}) => {
  const [activeSection, setActiveSection] = useState<SubSection>("controller");

  // Controller State
  const [killSwitchActive, setKillSwitchActive] = useState(
    guardedAutonomousController.isKillSwitchActive()
  );
  const [slos] = useState<OperationalSLOs>(guardedAutonomousController.getSLOs());
  const [cycles, setCycles] = useState<AutonomousExecutionCycle[]>(
    guardedAutonomousController.getRecentCycles()
  );
  const [isSimulatingCycle, setIsSimulatingCycle] = useState(false);

  // Diagnosis State
  const [diagnoses, setDiagnoses] = useState<DiagnosisResult[]>(
    failureDiagnosisEngine.getDiagnoses(currentTenant.id)
  );

  // Capacity State
  const [forecast, setForecast] = useState<CapacityForecast>(
    predictiveCapacityForecaster.generateForecast(4)
  );
  const [scalingPlan, setScalingPlan] = useState<ScalingActionPlan | null>(null);

  // Policy Simulation State
  const [simulationResult, setSimulationResult] = useState<PolicySimulation | null>(null);
  const [isSimulatingPolicy, setIsSimulatingPolicy] = useState(false);

  // Canary State
  const [canaryDecisions, setCanaryDecisions] = useState<CanaryDecision[]>(
    automatedCanaryAnalyzer.getHistory()
  );

  // Recovery & Hygiene State
  const [recoveryLogs, setRecoveryLogs] = useState<RecoveryAssessment[]>(
    automatedRunRecoveryService.getLogs()
  );
  const [hygieneRecords, setHygieneRecords] = useState<SandboxHygieneResult[]>(
    sandboxHygieneController.getRecords()
  );

  // Lifecycle State
  const [agents, setAgents] = useState<AgentLifecycleProfile[]>(
    lifecycleAutomationManager.getAgents()
  );
  const [tools, setTools] = useState<ToolVerificationManifest[]>(
    lifecycleAutomationManager.getTools()
  );

  // Automated Tests
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Handlers
  const handleToggleKillSwitch = () => {
    const newState = !killSwitchActive;
    guardedAutonomousController.setKillSwitch(newState, "admin_governance_ui");
    setKillSwitchActive(newState);
  };

  const handleSimulateAutonomousCycle = async (simulateVerificationFailure: boolean = false) => {
    setIsSimulatingCycle(true);
    try {
      await guardedAutonomousController.executeCycle(
        {
          runId: `run_live_${Date.now().toString(36)}`,
          tenantId: currentTenant.id,
          sandboxExitCode: 137,
          sandboxErrorOutput: "Process killed by cgroups OOM",
          runStatus: "failed",
        },
        "act_retry_idempotent_step",
        simulateVerificationFailure
      );
      setCycles(guardedAutonomousController.getRecentCycles());
      setDiagnoses(failureDiagnosisEngine.getDiagnoses(currentTenant.id));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSimulatingCycle(false);
    }
  };

  const handleRunCapacityPlan = () => {
    const plan = predictiveCapacityForecaster.evaluateAutoscaling(forecast, {
      activeWorkers: 6,
      warmSandboxes: 8,
      budgetCeilingUsd: 20.0,
    });
    setScalingPlan(plan);
  };

  const handleRunPolicySimulation = (candidateType: "safe" | "dangerous") => {
    setIsSimulatingPolicy(true);
    setTimeout(() => {
      const candidateRules =
        candidateType === "safe"
          ? [
              {
                actionPattern: "read:*",
                riskLevel: "low" as const,
                requiredApprovals: 0,
                dualApproverRequired: false,
                tracingLevel: "sampled" as const,
                description: "Safe file reading",
              },
              {
                actionPattern: "patch:apply",
                riskLevel: "medium" as const,
                requiredApprovals: 0,
                dualApproverRequired: false,
                tracingLevel: "full_diff" as const,
                description: "Scoped patch apply",
              },
              {
                actionPattern: "github:merge_main",
                riskLevel: "critical" as const,
                requiredApprovals: 2,
                dualApproverRequired: true,
                tracingLevel: "cryptographic_chain" as const,
                description: "Two-Person Rule for main merge",
              },
            ]
          : [
              {
                actionPattern: "read:*",
                riskLevel: "low" as const,
                requiredApprovals: 0,
                dualApproverRequired: false,
                tracingLevel: "sampled" as const,
                description: "Safe file reading",
              },
              {
                actionPattern: "github:merge_main",
                riskLevel: "critical" as const,
                requiredApprovals: 0, // DANGEROUS RELAXATION
                dualApproverRequired: false,
                tracingLevel: "sampled" as const,
                description: "Unapproved merge to main",
              },
            ];

      const sim = policySimulator.simulatePolicyCandidate(
        `candidate_${candidateType}_v2.1`,
        candidateRules
      );
      setSimulationResult(sim);
      setIsSimulatingPolicy(false);
    }, 400);
  };

  const handleRunCanaryEvaluation = (triggerRollback: boolean) => {
    const candidateMetrics = {
      errorRate: triggerRollback ? 0.045 : 0.011,
      p95LatencyMs: triggerRollback ? 3800 : 2150,
      firstTokenLatencyMs: 340,
      patchAcceptanceRate: triggerRollback ? 0.82 : 0.96,
      testsPassRate: triggerRollback ? 0.91 : 0.99,
      securityRejections: triggerRollback ? 1 : 0,
      fallbackRate: triggerRollback ? 0.08 : 0.01,
      costPerRunUsd: 0.17,
      duplicateExternalActions: triggerRollback ? 1 : 0,
    };

    const decision = automatedCanaryAnalyzer.evaluateCanary(
      `rel-${Date.now().toString(36)}`,
      triggerRollback ? 5 : 1,
      candidateMetrics
    );
    setCanaryDecisions(automatedCanaryAnalyzer.getHistory());
  };

  const handleTestHygiene = (simulateFailure: boolean) => {
    const res = sandboxHygieneController.sanitizeAndVerify(
      `sbx_eval_${Date.now().toString(36)}`,
      simulateFailure
    );
    setHygieneRecords(sandboxHygieneController.getRecords());
  };

  const handleEvaluateAgentHealth = (agentId: string) => {
    const health = lifecycleAutomationManager.evaluateAgentHealth(agentId);
    setAgents(lifecycleAutomationManager.getAgents());
    alert(`Agent Health Evaluated:\nState: ${health.state}\nRestricted: ${health.restricted ? "YES" : "NO"}\nReason: ${health.reason || "Healthy"}`);
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await runAutonomousOperationsTestSuite();
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
              <Bot className="w-3.5 h-3.5" />
              <span>Sprint 13 — Platform Intelligence & Autonomous Operations</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Guarded Autonomy: Automated Operations & Platform Intelligence
            </h1>
            <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
              Autonomously observing, diagnosing, and mitigating low-risk operational issues with idempotency guarantees,
              while strictly keeping high-risk decisions, production deployments, and policy changes behind human approval.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleKillSwitch}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                killSwitchActive
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30 shadow-lg shadow-rose-950/30"
                  : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Power className={`w-3.5 h-3.5 ${killSwitchActive ? "text-rose-400 animate-pulse" : "text-slate-400"}`} />
              <span>{killSwitchActive ? "Kill Switch Active (HALTED)" : "Disengage Kill Switch"}</span>
            </button>

            <button
              onClick={handleRunTests}
              disabled={isRunningTests}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${isRunningTests ? "animate-spin" : ""}`} />
              <span>{isRunningTests ? "Running Tests..." : "Run Sprint 13 Tests (10/10)"}</span>
            </button>
          </div>
        </div>

        {/* Operational SLOs Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mt-6 pt-5 border-t border-slate-800/80 font-mono">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">False Auto-Action</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">{slos.falseAutoActionRate}</div>
            <div className="text-[9px] text-slate-500">Target &lt; 0.1%</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">Unauthorized Action</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">{slos.unauthorizedActionRate}</div>
            <div className="text-[9px] text-slate-500">Zero Tolerance (0)</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">Recovery Success</div>
            <div className="text-base font-bold text-cyan-400 mt-0.5">{slos.recoverySuccessRate}</div>
            <div className="text-[9px] text-slate-500">Target &gt; 99%</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">Diagnosis Precision</div>
            <div className="text-base font-bold text-indigo-400 mt-0.5">{slos.diagnosisPrecision}</div>
            <div className="text-[9px] text-slate-500">Target &gt; 90%</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">Rollback Success</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">{slos.rollbackSuccessRate}</div>
            <div className="text-[9px] text-slate-500">100% Guaranteed</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">Policy Sim Coverage</div>
            <div className="text-base font-bold text-purple-400 mt-0.5">{slos.policySimulationCoverage}</div>
            <div className="text-[9px] text-slate-500">Target &gt; 95%</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">Canary False Neg</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">{slos.canaryFalseNegativeRate}</div>
            <div className="text-[9px] text-slate-500">Target &lt; 1%</div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex overflow-x-auto space-x-2 border-b border-slate-800/80 pb-2 scrollbar-none">
        {[
          { id: "controller", label: "Autonomous Controller", icon: Bot },
          { id: "diagnosis", label: "Failure Diagnosis Engine", icon: AlertTriangle },
          { id: "capacity", label: "Predictive Capacity", icon: Server },
          { id: "policy_simulation", label: "Policy Simulator", icon: ShieldCheck },
          { id: "canary", label: "Automated Canary", icon: Zap },
          { id: "recovery_hygiene", label: "Recovery & Hygiene", icon: RefreshCw },
          { id: "lifecycle", label: "Agent & Tool Lifecycle", icon: Lock },
          { id: "tests", label: "Sprint 13 Verifications", icon: Play },
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

      {/* SECTION 1: AUTONOMOUS CONTROLLER & ACTION CLASSIFICATION */}
      {activeSection === "controller" && (
        <div className="space-y-6">
          {/* Autonomous Loop Cockpit */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Bot className="w-5 h-5 text-indigo-400" />
                  <span>Guarded Autonomy Control Loop</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Pipeline: <code className="text-indigo-300 font-mono text-[11px]">observe → diagnose → propose → authorize → execute → verify → record</code>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSimulateAutonomousCycle(false)}
                  disabled={isSimulatingCycle || killSwitchActive}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md disabled:opacity-50"
                >
                  Simulate Auto-Safe Cycle (Success)
                </button>

                <button
                  onClick={() => handleSimulateAutonomousCycle(true)}
                  disabled={isSimulatingCycle || killSwitchActive}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md disabled:opacity-50"
                >
                  Simulate Failed Verification (Rollback)
                </button>
              </div>
            </div>

            {/* Invariant & Safety Boundaries Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Observe Only</span>
                <div className="text-sm font-bold text-white">Non-Intrusive</div>
                <p className="text-[11px] text-slate-400">Dashboard annotations, trace clustering, telemetry sampling</p>
              </div>

              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-emerald-500/20 text-xs space-y-1">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Auto Safe</span>
                <div className="text-sm font-bold text-emerald-300">Idempotent</div>
                <p className="text-[11px] text-slate-400">Idempotent step retries, worker recycling, pre-warming sandboxes</p>
              </div>

              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-amber-500/20 text-xs space-y-1">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Approval Required</span>
                <div className="text-sm font-bold text-amber-300">Gated by Humans</div>
                <p className="text-[11px] text-slate-400">Model routing shifts, quota expansion, policy updates, regional failovers</p>
              </div>

              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-rose-500/20 text-xs space-y-1">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Prohibited</span>
                <div className="text-sm font-bold text-rose-300">Hard Invariants</div>
                <p className="text-[11px] text-slate-400">Disabling RLS, revealing raw secrets, unapproved production merges, audit deletion</p>
              </div>
            </div>
          </div>

          {/* Recent Execution Cycles Stream */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span>Autonomous Execution Audit Stream</span>
              <span className="text-[11px] font-normal text-emerald-400 font-mono">Hash-Chained</span>
            </h3>

            <div className="space-y-2.5">
              {cycles.map((c) => (
                <div
                  key={c.cycleId}
                  className={`p-3.5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
                    c.executionStatus === "SUCCESS"
                      ? "bg-slate-950/60 border-emerald-500/20 text-slate-200"
                      : c.executionStatus === "VERIFICATION_FAILED"
                      ? "bg-rose-950/20 border-rose-500/30 text-rose-200"
                      : "bg-slate-950/60 border-slate-800 text-slate-300"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 font-mono">
                      <span className="font-bold text-white">{c.cycleId}</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-indigo-400">{c.proposedActionId}</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-400">{c.telemetry.runId}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Diagnosis: <span className="text-slate-300 font-sans">{c.diagnosis.probableCause}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 font-mono text-[11px]">
                    {c.rollbackExecuted && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Rollback Executed
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        c.executionStatus === "SUCCESS"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {c.executionStatus}
                    </span>
                    <span className="text-slate-500">{c.durationMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: FAILURE DIAGNOSIS ENGINE */}
      {activeSection === "diagnosis" && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                Automated Failure Diagnosis & Recommended Actions
              </h3>
              <span className="text-xs text-indigo-400 font-mono">Precision: {slos.diagnosisPrecision}</span>
            </div>

            <div className="space-y-3">
              {diagnoses.map((d) => (
                <div
                  key={d.incidentId}
                  className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-white">{d.incidentId}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      Confidence: {(d.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 font-medium">
                    Probable Cause: <span className="text-amber-300">{d.probableCause}</span>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono">
                    Affected Components: {d.affectedComponents.join(", ")}
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <div className="text-[10px] font-bold uppercase text-slate-500">Autonomous Recommendations</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {d.recommendedActions.map((rec) => (
                        <div
                          key={rec.id}
                          className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between font-mono">
                            <span className="font-bold text-cyan-400">{rec.actionType}</span>
                            <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              Risk: {rec.risk}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug">{rec.estimatedImpact}</p>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Target: {rec.targetEntityId} • {rec.requiresApproval ? "Requires Sign-off" : "Auto-Executable"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: PREDICTIVE CAPACITY PLANNING */}
      {activeSection === "capacity" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400">Forecast Horizon</span>
              <div className="text-xl font-bold text-white mt-1">{forecast.horizonHours} Hours</div>
              <div className="text-[10px] text-slate-500">Next traffic spike window</div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400">Predicted Runs</span>
              <div className="text-xl font-bold text-indigo-400 mt-1">
                {forecast.predictedRuns.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500">
                CI: [{forecast.confidenceInterval.lower} - {forecast.confidenceInterval.upper}]
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400">Predicted Peak Concurrency</span>
              <div className="text-xl font-bold text-cyan-400 mt-1">{forecast.predictedPeakConcurrency}</div>
              <div className="text-[10px] text-slate-500">Concurrent active runs</div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400">Required Sandboxes</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">{forecast.requiredSandboxSlots}</div>
              <div className="text-[10px] text-slate-500">Pre-warmed slots</div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                Proactive Capacity Scaling Simulator
              </h3>

              <button
                onClick={handleRunCapacityPlan}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                Evaluate Autoscaling Plan
              </button>
            </div>

            {scalingPlan ? (
              <div className="bg-slate-950/70 border border-indigo-500/30 rounded-xl p-4 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-indigo-300 font-bold">
                  <span>Plan ID: {scalingPlan.planId}</span>
                  <span className="text-emerald-400">STATUS: APPROVED FOR EXECUTION</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300 pt-1">
                  <div>Pre-warm Slots: +{scalingPlan.preWarmSandboxCount}</div>
                  <div>Worker Adjustment: {scalingPlan.workerAdjustment > 0 ? `+${scalingPlan.workerAdjustment}` : scalingPlan.workerAdjustment}</div>
                  <div>Projected Cost: ${scalingPlan.projectedCostUsd}</div>
                  <div>Budget Cap: ${scalingPlan.budgetCeilingUsd}</div>
                </div>
                <div className="text-[11px] text-slate-400 pt-1 font-sans">
                  {scalingPlan.reason}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">
                Click &quot;Evaluate Autoscaling Plan&quot; to compute resource allocations within budget ceilings.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 4: POLICY SIMULATOR & REPLAY */}
      {activeSection === "policy_simulation" && (
        <div className="space-y-6">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                  <span>Historical Policy Simulator & Replay Engine</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Replays historical decisions against candidate policy rules to detect unguarded high-risk regressions
                  prior to canary rollout.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRunPolicySimulation("safe")}
                  disabled={isSimulatingPolicy}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md"
                >
                  Simulate Compliant Policy (Pass)
                </button>
                <button
                  onClick={() => handleRunPolicySimulation("dangerous")}
                  disabled={isSimulatingPolicy}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md"
                >
                  Simulate Flawed Policy (Block)
                </button>
              </div>
            </div>

            {simulationResult && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-2 ${
                  simulationResult.passedSafetyCheck
                    ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-200"
                    : "bg-rose-950/30 border-rose-500/30 text-rose-200"
                }`}
              >
                <div className="flex items-center justify-between font-bold text-sm">
                  <span className="flex items-center gap-2">
                    {simulationResult.passedSafetyCheck ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span>
                      {simulationResult.passedSafetyCheck ? "SIMULATION PASSED" : "SIMULATION BLOCKED"} — {simulationResult.candidatePolicyVersion}
                    </span>
                  </span>
                  <span className="font-mono text-xs">{simulationResult.simulationId}</span>
                </div>

                {simulationResult.blockReasons.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1 text-rose-300 font-mono text-[11px]">
                    {simulationResult.blockReasons.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/60 font-mono text-[11px]">
                  <div>Historical Sample: {simulationResult.sampleSize}</div>
                  <div>Newly Allowed: {simulationResult.newlyAllowed}</div>
                  <div>Newly Denied: {simulationResult.newlyDenied}</div>
                  <div>High Risk Diffs: {simulationResult.highRiskDifferences}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 5: AUTOMATED CANARY ANALYSIS */}
      {activeSection === "canary" && (
        <div className="space-y-6">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  <span>Automated Canary Analysis & Instant Rollback</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Evaluates 1% $\to$ 5% $\to$ 10% traffic slices against production baseline SLAs.
                  Enforces immediate zero-tolerance rollback on any security violation or duplicate side effect.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRunCanaryEvaluation(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md"
                >
                  Test Compliant Slice (Advance)
                </button>
                <button
                  onClick={() => handleRunCanaryEvaluation(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md"
                >
                  Test Tainted Slice (Rollback)
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {canaryDecisions.map((cd, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border text-xs space-y-2 font-mono ${
                    cd.decision === "advance"
                      ? "bg-slate-950/70 border-emerald-500/30 text-emerald-200"
                      : cd.decision === "rollback"
                      ? "bg-rose-950/20 border-rose-500/30 text-rose-200"
                      : "bg-slate-950/70 border-slate-800 text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>Release: {cd.releaseId} • Traffic: {cd.currentTrafficWeight}% → {cd.nextTrafficWeight}%</span>
                    <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                      Decision: {cd.decision}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 font-sans">
                    {cd.reasons.join(" • ")}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800/60 text-[11px] text-slate-400">
                    <div>Error Rate: {(cd.metricsComparison.candidateErrorRate * 100).toFixed(1)}%</div>
                    <div>p95 Latency: {cd.metricsComparison.candidateP95Ms}ms</div>
                    <div>Security Rejections: {cd.metricsComparison.securityRejections}</div>
                    <div>Duplicate Actions: {cd.metricsComparison.duplicateExternalActions}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: RECOVERY & HYGIENE */}
      {activeSection === "recovery_hygiene" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Automated Run Recovery */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span>Automated Run Recovery</span>
              <span className="text-[11px] font-normal text-emerald-400">Idempotency Guard Active</span>
            </h3>

            <div className="space-y-3">
              {recoveryLogs.map((r, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5 font-mono text-xs"
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-white">{r.runId}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        r.isAutoRecoverable
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {r.resolutionStrategy}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    {r.reason}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Trigger: {r.trigger} • Idempotency Verified: {r.idempotencyVerified ? "YES" : "NO"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sandbox Hygiene Sentinel */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                Sandbox Hygiene & Quarantine
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleTestHygiene(false)}
                  className="px-2 py-1 rounded text-[11px] font-semibold bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                >
                  Scrub Clean
                </button>
                <button
                  onClick={() => handleTestHygiene(true)}
                  className="px-2 py-1 rounded text-[11px] font-semibold bg-rose-600/20 text-rose-400 hover:bg-rose-600/30"
                >
                  Quarantine Fail
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {hygieneRecords.map((h, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5 font-mono text-xs"
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-white">{h.sandboxId}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        h.status === "clean"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {h.status}
                    </span>
                  </div>
                  {h.quarantineReason && (
                    <div className="text-[11px] text-rose-300 font-sans">
                      {h.quarantineReason}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 pt-1">
                    <div>Filesystem Scrubbed: {h.filesystemDestroyed ? "YES" : "NO"}</div>
                    <div>Artifact Isolated: {h.artifactIsolationVerified ? "YES" : "NO"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 7: AGENT & TOOL LIFECYCLE */}
      {activeSection === "lifecycle" && (
        <div className="space-y-6">
          {/* Agent Lifecycle Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Agent Lifecycle Automation & State Enforcement
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Agent</th>
                    <th className="py-2.5 px-3">State</th>
                    <th className="py-2.5 px-3">Owner</th>
                    <th className="py-2.5 px-3">Rejection Rate</th>
                    <th className="py-2.5 px-3">Failure Rate</th>
                    <th className="py-2.5 px-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {agents.map((a) => (
                    <tr key={a.agentId} className="hover:bg-slate-850/40">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white">{a.name}</div>
                        <div className="text-[10px] text-slate-500">{a.agentId} (v{a.version})</div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            a.state === "active"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : a.state === "restricted"
                              ? "bg-rose-500/10 text-rose-400"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {a.state}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-sans text-[11px]">
                        {a.owner}
                      </td>
                      <td className="py-3 px-3">
                        <span className={a.securityRejectionRate > 0.05 ? "text-rose-400 font-bold" : "text-slate-400"}>
                          {(a.securityRejectionRate * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={a.failureRate > 0.15 ? "text-amber-400 font-bold" : "text-slate-400"}>
                          {(a.failureRate * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => handleEvaluateAgentHealth(a.agentId)}
                          className="px-2.5 py-1 rounded text-[10px] font-semibold bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30"
                        >
                          Evaluate Health
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tool Verification Gates */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Tool Compliance Gates (7 Automated Checks)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tools.map((t) => {
                const check = lifecycleAutomationManager.verifyToolCompliance(t.toolId);
                return (
                  <div
                    key={t.toolId}
                    className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-2 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{t.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          check.isCompliant
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-rose-500/10 text-rose-400"
                        }`}
                      >
                        {check.isCompliant ? "All 7 Gates Passed" : "Compliance Failed"}
                      </span>
                    </div>

                    {!check.isCompliant && (
                      <div className="text-[11px] text-rose-300 font-sans">
                        Failing Gates: {check.failingGates.join(", ")}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-400 pt-1">
                      <div>Signed: {t.signatureValid ? "✓" : "✗"}</div>
                      <div>Strict Egress: {t.networkAllowlistStrict ? "✓" : "✗"}</div>
                      <div>Idempotent: {t.idempotencySupported ? "✓" : "✗"}</div>
                      <div>Sandbox Passed: {t.sandboxTestsPassed ? "✓" : "✗"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 8: SPRINT 13 AUTOMATED TESTS (10/10) */}
      {activeSection === "tests" && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Play className="w-5 h-5 text-indigo-400" />
                <span>Sprint 13 Autonomous Operations Test Suite (10 / 10)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Automated end-to-end verification of Action Classification, Failure Diagnosis, Predictive Capacity,
                Step Economics, Policy Simulation, Canary Analysis, Run Recovery, Sandbox Hygiene, and the Autonomous Controller.
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
              Click &quot;Run Test Suite&quot; above to execute the 10 automated Autonomous Operations verification tests.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
