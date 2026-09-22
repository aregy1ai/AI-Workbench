import React, { useState, useEffect } from "react";
import { TenantInfo, DiffHunk } from "../types";
import { Run, RunStatus, Step, Task } from "../../packages/contracts/src/run";
import { runStateMachine } from "../../packages/runs/src/state-machine";
import { toolGateway } from "../../packages/tools/src/gateway";
import { ContextSigner } from "../../packages/auth/src/context";
import { secretBroker } from "../../packages/sandbox/src/scheduler";
import { budgetGuard } from "../../packages/budget/src/guard";
import { auditLedger } from "../../packages/audit/src/hash-chain";
import { SAMPLE_DIFF } from "../data/mockData";
import {
  Play,
  RotateCcw,
  Ban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCode,
  ShieldAlert,
  GitPullRequest,
  Terminal,
  Activity,
  UserCheck,
  XCircle,
  ExternalLink,
  ChevronRight,
  Boxes,
} from "lucide-react";

interface RunSimulatorTabProps {
  currentTenant: TenantInfo;
  onRefreshMetrics: () => void;
}

export const RunSimulatorTab: React.FC<RunSimulatorTabProps> = ({
  currentTenant,
  onRefreshMetrics,
}) => {
  const currentWorkspace = currentTenant.workspaces[0];
  const currentRepo = currentWorkspace.repositories[0];

  const [task, setTask] = useState<Task>({
    id: "task_auth_fix_901",
    tenantId: currentTenant.id,
    workspaceId: currentWorkspace.id,
    repositoryId: currentRepo.id,
    title: "Fix auth session token race condition & add isolation test",
    description: "Patch memory cache race condition in validateSessionToken with atomic lock, enforce session revocation checks, and verify in isolated gVisor sandbox.",
    baseBranch: "main",
    requestedBy: "usr_lead_engineer_42",
    riskLevel: "high",
    status: "created",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [run, setRun] = useState<Run>({
    id: "run_agent_001",
    tenantId: currentTenant.id,
    workspaceId: currentWorkspace.id,
    taskId: task.id,
    status: "created",
    cancellationEpoch: 0,
    version: 0,
    runtimeName: "standard-code-agent",
    runtimeVersion: "1.0.0",
    budgetLimit: 5.0,
    budgetReserved: 0,
    budgetConsumed: 0,
    createdAt: new Date().toISOString(),
  });

  const [steps, setSteps] = useState<Step[]>([]);
  const [currentHunk, setCurrentHunk] = useState<DiffHunk[]>(SAMPLE_DIFF);
  const [pendingApproval, setPendingApproval] = useState<{
    id: string;
    action: string;
    reason: string;
    risk: string;
  } | null>(null);

  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [executionLog, setExecutionLog] = useState<string[]>([
    "System ready. Control Plane initialized with tenant isolation and RLS enforcement.",
  ]);

  const addLog = (msg: string) => {
    setExecutionLog((prev) => [
      `[${new Date().toLocaleTimeString()}] ${msg}`,
      ...prev.slice(0, 40),
    ]);
  };

  const signer = new ContextSigner();

  // Reset Run
  const handleResetRun = () => {
    const newRun: Run = {
      id: `run_agent_${Math.random().toString(36).substring(2, 7)}`,
      tenantId: currentTenant.id,
      workspaceId: currentWorkspace.id,
      taskId: task.id,
      status: "created",
      cancellationEpoch: 0,
      version: 0,
      runtimeName: "standard-code-agent",
      runtimeVersion: "1.0.0",
      budgetLimit: 5.0,
      budgetReserved: 0,
      budgetConsumed: 0,
      createdAt: new Date().toISOString(),
    };
    setRun(newRun);
    setSteps([]);
    setPendingApproval(null);
    setIsAutoRunning(false);
    addLog("Run state re-initialized to 'created'.");
    onRefreshMetrics();
  };

  // State Transition Helper
  const performTransition = (next: RunStatus): Run | null => {
    const res = runStateMachine.transition(run, next, run.version);
    if (!res.ok) {
      addLog(`[ERROR] State transition rejected: ${res.error.message}`);
      return null;
    }
    setRun(res.value);
    onRefreshMetrics();
    return res.value;
  };

  // Cancellation Trigger
  const handleCancelRun = () => {
    const cancelRes = runStateMachine.requestCancellation(run, run.version);
    if (!cancelRes.ok) {
      addLog(`[CANCEL FAILED] ${cancelRes.error.message}`);
      return;
    }
    const cancelled = cancelRes.value;
    setRun(cancelled);
    addLog(`[CONTROL PLANE] Cancellation requested! Incremented epoch to ${cancelled.cancellationEpoch}. Invalidating all active secret leases & tool contexts...`);

    // Invalidate leases
    const active = secretBroker.getActiveLeases(run.id);
    active.forEach((l) => secretBroker.revoke(l.id));

    // Audit event
    auditLedger.append({
      tenantId: run.tenantId,
      workspaceId: run.workspaceId,
      runId: run.id,
      actorId: "human_operator",
      eventType: "run.cancelled",
      payloadSummary: `Run cancelled by operator. Invalidation epoch: ${cancelled.cancellationEpoch}. All active secret leases revoked.`,
    });

    setTimeout(() => {
      const finalCancelled = runStateMachine.transition(cancelled, "cancelled", cancelled.version);
      if (finalCancelled.ok) {
        setRun(finalCancelled.value);
        addLog("[CONTROL PLANE] Run status finalized to 'cancelled'. Process cleaned.");
      }
      onRefreshMetrics();
    }, 400);

    setIsAutoRunning(false);
  };

  // Step 1: Initialize to Queued then Running
  const startRun = async () => {
    let r = performTransition("queued");
    if (!r) return;
    addLog(`[RUN QUEUED] Run ${r.id} enqueued in Redis queue.`);

    setTimeout(async () => {
      const running = runStateMachine.transition(r!, "running", r!.version);
      if (!running.ok) return;
      r = running.value;
      setRun(r);
      addLog(`[WORKER CLAIM] Worker worker-exec-01 claimed run. Status -> 'running'. Version: ${r.version}`);

      // Initial Reasoning Step
      const step1: Step = {
        id: `step_${Math.random().toString(36).substring(2, 7)}`,
        tenantId: r.tenantId,
        workspaceId: r.workspaceId,
        runId: r.id,
        sequence: 1,
        type: "reasoning",
        status: "succeeded",
        inputHash: "in_plan_hash_01",
        summary: "Agent analyzed task description: Plan is to inspect session-manager.ts, apply locked session resolution, execute unit tests, and open PR.",
        attempt: 1,
        createdAt: new Date().toISOString(),
      };
      setSteps([step1]);
      addLog("[INTELLIGENCE PLANE] LLM Gateway: Planning step completed.");
      onRefreshMetrics();
    }, 300);
  };

  // Step 2: Tool Call repo.read_file
  const executeStepReadFile = async () => {
    if (run.status !== "running") return;

    addLog("[TOOL GATEWAY] Dispatching tool 'repo.read_file' (Risk: LOW)...");

    const signedCtx = signer.sign({
      tenantId: run.tenantId,
      workspaceId: run.workspaceId,
      runId: run.id,
      stepId: "step_read_02",
      actorId: "agent_runner",
      requestedAction: "repo.read_file",
      riskLevel: "low",
      policyVersion: "1.0",
      cancellationEpoch: run.cancellationEpoch,
    });

    const { response, updatedRun } = await toolGateway.executeTool(
      {
        contextToken: JSON.stringify(signedCtx),
        runId: run.id,
        stepId: "step_read_02",
        toolName: "repo.read_file",
        toolVersion: "1.0.0",
        idempotencyKey: `read:${run.id}:src/auth/session-manager.ts`,
        input: { path: "src/auth/session-manager.ts" },
      },
      run
    );

    setRun(updatedRun);

    const step2: Step = {
      id: "step_read_02",
      tenantId: run.tenantId,
      workspaceId: run.workspaceId,
      runId: run.id,
      sequence: 2,
      type: "tool_call",
      status: "succeeded",
      inputHash: "in_read_file_hash",
      summary: "Tool 'repo.read_file' completed. Analyzed 48 lines of auth session cache code. Ephemeral secret lease issued & revoked.",
      attempt: 1,
      createdAt: new Date().toISOString(),
    };
    setSteps((prev) => [...prev, step2]);
    addLog(`[TOOL SUCCESS] Read file completed in ${response.durationMs}ms. Cost: $${response.cost.toFixed(4)}.`);
    onRefreshMetrics();
  };

  // Step 3: Tool Call workspace.apply_patch (Triggers Approval)
  const executeStepApplyPatch = async () => {
    if (run.status !== "running") return;

    addLog("[TOOL GATEWAY] Dispatching tool 'workspace.apply_patch' (Risk: HIGH)...");

    const signedCtx = signer.sign({
      tenantId: run.tenantId,
      workspaceId: run.workspaceId,
      runId: run.id,
      stepId: "step_patch_03",
      actorId: "agent_runner",
      requestedAction: "workspace.apply_patch",
      riskLevel: "high",
      policyVersion: "1.0",
      cancellationEpoch: run.cancellationEpoch,
    });

    const { response, updatedRun } = await toolGateway.executeTool(
      {
        contextToken: JSON.stringify(signedCtx),
        runId: run.id,
        stepId: "step_patch_03",
        toolName: "workspace.apply_patch",
        toolVersion: "1.0.0",
        idempotencyKey: `patch:${run.id}:hash_v1`,
        input: { patch: "unified_diff_content" },
      },
      run
    );

    if (response.status === "approval_required") {
      const waiting = runStateMachine.transition(updatedRun, "waiting_approval", updatedRun.version);
      if (waiting.ok) {
        setRun(waiting.value);
      }
      setPendingApproval({
        id: response.approvalId || "appr_99",
        action: "workspace.apply_patch",
        reason: response.reasonCode || "High risk code modification",
        risk: "HIGH",
      });

      const step3: Step = {
        id: "step_patch_03",
        tenantId: run.tenantId,
        workspaceId: run.workspaceId,
        runId: run.id,
        sequence: 3,
        type: "approval",
        status: "waiting",
        inputHash: "in_patch_hunk_hash",
        summary: "POLICY GATE: Human-in-the-loop approval required for 'workspace.apply_patch'. System state shifted to 'waiting_approval'.",
        attempt: 1,
        createdAt: new Date().toISOString(),
      };
      setSteps((prev) => [...prev, step3]);
      addLog("[POLICY ENGINE] High risk action halted! Human approval required before sandbox lease can be issued.");
      onRefreshMetrics();
    }
  };

  // Human approves patch
  const handleApprovePatch = async () => {
    if (!pendingApproval) return;

    addLog(`[HUMAN APPROVAL] Operator approved ${pendingApproval.id}. Gating cleared.`);
    setPendingApproval(null);

    // Transition back to running
    const running = runStateMachine.transition(run, "running", run.version);
    if (!running.ok) return;
    setRun(running.value);

    // Update step 3
    setSteps((prev) =>
      prev.map((s) =>
        s.sequence === 3
          ? {
              ...s,
              status: "succeeded",
              summary: "Human approval granted by operator. Patch applied cleanly to sandbox filesystem.",
            }
          : s
      )
    );

    auditLedger.append({
      tenantId: run.tenantId,
      workspaceId: run.workspaceId,
      runId: run.id,
      actorId: "human_operator",
      eventType: "approval.granted",
      payloadSummary: `Operator approved patch execution for run ${run.id}. Risk mitigated via diff inspection.`,
    });

    onRefreshMetrics();
    addLog("[EXECUTION PLANE] Patch applied to ephemeral sandbox fs. Proceeding to sandbox tests...");
  };

  // Step 4: Sandbox execution: workspace.run_tests
  const executeStepRunTests = async () => {
    if (run.status !== "running") return;

    addLog("[SANDBOX SCHEDULER] Booting gVisor profile (CPU: 2, Mem: 4Gi, seccomp: strict)...");

    const signedCtx = signer.sign({
      tenantId: run.tenantId,
      workspaceId: run.workspaceId,
      runId: run.id,
      stepId: "step_test_04",
      actorId: "agent_runner",
      requestedAction: "workspace.run_tests",
      riskLevel: "medium",
      policyVersion: "1.0",
      cancellationEpoch: run.cancellationEpoch,
    });

    const { response, updatedRun } = await toolGateway.executeTool(
      {
        contextToken: JSON.stringify(signedCtx),
        runId: run.id,
        stepId: "step_test_04",
        toolName: "workspace.run_tests",
        toolVersion: "1.0.0",
        idempotencyKey: `test:${run.id}:v1`,
        input: { suite: "tests/auth/session.test.ts" },
      },
      run
    );

    setRun(updatedRun);

    const step4: Step = {
      id: "step_test_04",
      tenantId: run.tenantId,
      workspaceId: run.workspaceId,
      runId: run.id,
      sequence: 4,
      type: "tool_call",
      status: "succeeded",
      inputHash: "in_tests_hash",
      summary: "Sandbox test runner completed: 18 passed, 0 failed, 94.2% test coverage. Zero security escapes.",
      attempt: 1,
      createdAt: new Date().toISOString(),
    };
    setSteps((prev) => [...prev, step4]);
    addLog("[SANDBOX TEST] 18 unit tests passed in 1.24s. All concurrency assertions green!");
    onRefreshMetrics();
  };

  // Step 5: github.create_pull_request & finalize
  const executeStepCreatePR = async () => {
    if (run.status !== "running") return;

    addLog("[GITHUB ADAPTER] Creating Pull Request with signed credential lease...");

    const signedCtx = signer.sign({
      tenantId: run.tenantId,
      workspaceId: run.workspaceId,
      runId: run.id,
      stepId: "step_pr_05",
      actorId: "agent_runner",
      requestedAction: "github.create_pull_request",
      riskLevel: "high",
      policyVersion: "1.0",
      cancellationEpoch: run.cancellationEpoch,
    });

    const { response, updatedRun } = await toolGateway.executeTool(
      {
        contextToken: JSON.stringify(signedCtx),
        runId: run.id,
        stepId: "step_pr_05",
        toolName: "github.create_pull_request",
        toolVersion: "1.0.0",
        idempotencyKey: `pr:${run.id}:auth-fix`,
        input: {
          title: "fix(auth): prevent session token race and enforce isolation",
          baseBranch: "main",
          headBranch: "agent/patch-auth-race-142",
        },
      },
      run
    );

    const step5: Step = {
      id: "step_pr_05",
      tenantId: run.tenantId,
      workspaceId: run.workspaceId,
      runId: run.id,
      sequence: 5,
      type: "tool_call",
      status: "succeeded",
      inputHash: "in_pr_hash",
      summary: "Pull Request PR-#142 published to acme-corp/payment-gateway. Secret lease revoked immediately.",
      attempt: 1,
      createdAt: new Date().toISOString(),
    };
    setSteps((prev) => [...prev, step5]);

    // Finalize to Succeeded
    const finalRun = runStateMachine.transition(updatedRun, "succeeded", updatedRun.version);
    if (finalRun.ok) {
      setRun(finalRun.value);
    }

    addLog(`[RUN COMPLETED] Status -> 'succeeded'. Total Consumed: $${updatedRun.budgetConsumed.toFixed(4)}. Secret leases 100% revoked.`);
    onRefreshMetrics();
    setIsAutoRunning(false);
  };

  // Auto Run Orchestrator
  useEffect(() => {
    if (!isAutoRunning) return;

    const timer = setTimeout(() => {
      if (run.status === "created") {
        startRun();
      } else if (run.status === "running" && steps.length === 1) {
        executeStepReadFile();
      } else if (run.status === "running" && steps.length === 2) {
        executeStepApplyPatch();
      } else if (run.status === "running" && steps.length === 3 && steps[2].status === "succeeded") {
        executeStepRunTests();
      } else if (run.status === "running" && steps.length === 4) {
        executeStepCreatePR();
      }
    }, 1100);

    return () => clearTimeout(timer);
  }, [isAutoRunning, run.status, steps]);

  // Status Badge Helper
  const getStatusColor = (status: RunStatus) => {
    switch (status) {
      case "created":
        return "bg-slate-800 text-slate-300 border-slate-700";
      case "queued":
        return "bg-indigo-950 text-indigo-300 border-indigo-700";
      case "running":
        return "bg-cyan-950 text-cyan-300 border-cyan-500 animate-pulse";
      case "waiting_approval":
        return "bg-amber-950 text-amber-300 border-amber-500 animate-bounce";
      case "succeeded":
        return "bg-emerald-950 text-emerald-300 border-emerald-500";
      case "cancellation_requested":
      case "cancelling":
      case "cancelled":
        return "bg-rose-950 text-rose-300 border-rose-500";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const stateMachineNodes: RunStatus[] = [
    "created",
    "queued",
    "running",
    "waiting_approval",
    "succeeded",
    "cancelled",
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner: Task & Goal */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
                Active Task · {task.id}
              </span>
              <span className="text-xs text-slate-400">
                Repo: <code className="text-slate-200">{currentRepo.fullName}</code> ({task.baseBranch})
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">{task.title}</h2>
            <p className="text-xs text-slate-400 max-w-3xl">{task.description}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            {run.status === "created" && (
              <>
                <button
                  onClick={() => {
                    setIsAutoRunning(true);
                  }}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-500/20 flex items-center space-x-1.5 transition-all"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Autonomous Run</span>
                </button>
                <button
                  onClick={startRun}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-all"
                >
                  Step 1 (Queue)
                </button>
              </>
            )}

            {run.status === "running" && (
              <>
                {steps.length === 1 && (
                  <button
                    onClick={executeStepReadFile}
                    className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium shadow flex items-center space-x-1.5"
                  >
                    <span>Execute Step 2: Read File</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {steps.length === 2 && (
                  <button
                    onClick={executeStepApplyPatch}
                    className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium shadow flex items-center space-x-1.5"
                  >
                    <span>Execute Step 3: Apply Patch (Gated)</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {steps.length === 3 && steps[2].status === "succeeded" && (
                  <button
                    onClick={executeStepRunTests}
                    className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow flex items-center space-x-1.5"
                  >
                    <span>Execute Step 4: Run Sandbox Tests</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {steps.length === 4 && (
                  <button
                    onClick={executeStepCreatePR}
                    className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow flex items-center space-x-1.5"
                  >
                    <span>Execute Step 5: Publish PR</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={handleCancelRun}
                  className="px-3 py-2 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-medium flex items-center space-x-1.5 transition-all"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Emergency Cancel</span>
                </button>
              </>
            )}

            {(run.status === "succeeded" || run.status === "cancelled") && (
              <button
                onClick={handleResetRun}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center space-x-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Run</span>
              </button>
            )}
          </div>
        </div>

        {/* State Machine Status Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">State Machine:</span>
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {stateMachineNodes.map((node, idx) => {
                const isActive = run.status === node;
                return (
                  <React.Fragment key={node}>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                        isActive
                          ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                          : "text-slate-500"
                      }`}
                    >
                      {node}
                    </span>
                    {idx < stateMachineNodes.length - 1 && (
                      <span className="text-slate-700 text-[10px]">→</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-4 text-slate-400">
            <div>
              Version: <span className="font-mono text-slate-200 font-semibold">{run.version}</span>
            </div>
            <div>
              Cancellation Epoch:{" "}
              <span className="font-mono text-slate-200 font-semibold">{run.cancellationEpoch}</span>
            </div>
            <div>
              Status:{" "}
              <span
                className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${getStatusColor(
                  run.status
                )}`}
              >
                {run.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Human Approval Required Gate (Modal/Banner) */}
      {pendingApproval && (
        <div className="bg-amber-950/40 border-2 border-amber-500/70 rounded-xl p-5 text-amber-200 shadow-xl shadow-amber-950/40">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400 mt-0.5">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/30 text-amber-300">
                    Policy Gate Enforced · Approval ID: {pendingApproval.id}
                  </span>
                  <span className="text-xs text-amber-400 font-medium">Risk Level: HIGH</span>
                </div>
                <h3 className="font-bold text-base text-white">
                  Human Authorization Required for Tool '{pendingApproval.action}'
                </h3>
                <p className="text-xs text-amber-300/80">
                  The Agent requested to modify repository code files. Per security policy, code changes require manual diff review prior to secret lease issuance and sandbox execution.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleApprovePatch}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg flex items-center space-x-1.5 transition-all"
              >
                <UserCheck className="w-4 h-4" />
                <span>Approve & Issue Sandbox Lease</span>
              </button>
              <button
                onClick={() => {
                  setPendingApproval(null);
                  handleCancelRun();
                }}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Reject & Deny
              </button>
            </div>
          </div>

          {/* Interactive Code Diff Viewer */}
          <div className="mt-4 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden text-xs font-mono">
            <div className="bg-slate-900 px-3 py-1.5 text-slate-400 border-b border-slate-800 flex items-center justify-between">
              <span>Diff Preview: src/auth/session-manager.ts</span>
              <span className="text-[10px] text-emerald-400">+5 lines, -2 lines</span>
            </div>
            <div className="p-3 overflow-x-auto space-y-0.5">
              {currentHunk[0].changes.map((c, i) => (
                <div
                  key={i}
                  className={`px-2 py-0.5 rounded ${
                    c.type === "add"
                      ? "bg-emerald-950/60 text-emerald-300"
                      : c.type === "delete"
                      ? "bg-rose-950/60 text-rose-300 line-through"
                      : "text-slate-400"
                  }`}
                >
                  {c.line}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Steps Progression Timeline & Execution Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Step Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Agent Execution Steps ({steps.length})</span>
            </h3>
            <span className="text-xs text-slate-500">
              Guarded by Signed Execution Contexts & Nonce Replay Prevention
            </span>
          </div>

          {steps.length === 0 ? (
            <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-xl p-10 text-center text-slate-500">
              <Boxes className="w-10 h-10 mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-medium">No steps executed yet</p>
              <p className="text-xs text-slate-600 mt-1">
                Click "Start Autonomous Run" or use the step-by-step buttons above to begin execution.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {steps.map((st) => (
                <div
                  key={st.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-lg bg-slate-800 text-cyan-400 mt-0.5">
                        {st.type === "reasoning" && <Terminal className="w-4 h-4" />}
                        {st.type === "tool_call" && <FileCode className="w-4 h-4" />}
                        {st.type === "approval" && <ShieldAlert className="w-4 h-4 text-amber-400" />}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-white">
                            Step #{st.sequence}: {st.type.toUpperCase()}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">({st.id})</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              st.status === "succeeded"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
                                : "bg-amber-950 text-amber-400 border border-amber-800/50"
                            }`}
                          >
                            {st.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{st.summary}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(st.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sandbox Profile & Limits Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-semibold text-slate-200">Active Sandbox Profile: isolated-gvisor-v1</span>
              <span className="text-emerald-400 font-medium">Ephemeral Security Active</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-slate-400">
              <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                <span className="text-slate-500 block text-[10px]">Runtime</span>
                <span className="font-mono text-cyan-400 font-medium">gVisor (runsc)</span>
              </div>
              <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                <span className="text-slate-500 block text-[10px]">Memory / CPU</span>
                <span className="font-mono text-slate-200 font-medium">4Gi / 2 Core</span>
              </div>
              <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                <span className="text-slate-500 block text-[10px]">Seccomp / Root</span>
                <span className="font-mono text-emerald-400 font-medium">Strict / UID 10001</span>
              </div>
              <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                <span className="text-slate-500 block text-[10px]">Filesystem</span>
                <span className="font-mono text-amber-400 font-medium">Ephemeral Scratch</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Control Plane Live Logs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-purple-400" />
              <span>Control Plane Logs</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">Live Stream</span>
          </div>

          <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 h-[420px] overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1.5 scrollbar-thin">
            {executionLog.map((log, index) => (
              <div
                key={index}
                className={`leading-relaxed ${
                  log.includes("[ERROR]") || log.includes("[CANCEL FAILED]")
                    ? "text-rose-400"
                    : log.includes("[POLICY ENGINE]")
                    ? "text-amber-400"
                    : log.includes("[TOOL SUCCESS]") || log.includes("[RUN COMPLETED]")
                    ? "text-emerald-400"
                    : log.includes("[CONTROL PLANE]")
                    ? "text-cyan-400"
                    : "text-slate-400"
                }`}
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
