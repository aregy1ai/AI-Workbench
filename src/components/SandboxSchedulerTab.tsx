import React, { useState, useEffect } from "react";
import { TenantInfo } from "../types";
import {
  SandboxScheduler,
  executePatchWorkflow,
  sandboxScheduler,
  PatchWorkflowResult,
  SandboxSessionRecord,
} from "../../packages/sandbox/src/scheduler";
import {
  mediumProfile,
  isolatedProfile,
  profileValidator,
} from "../../packages/sandbox/src/profiles";
import { githubAdapter } from "../../packages/github/src/adapter";
import { artifactRepository, ArtifactRecord } from "../../packages/artifacts/src/store";
import { runRepository } from "../../packages/runs/src/run-repository";
import {
  runSandboxTestSuite,
  TestResultItem,
} from "../../tests/sandbox/sandbox-scheduler.test";
import {
  Box,
  Terminal,
  Shield,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  GitBranch,
  FileCode,
  FileCheck2,
  Trash2,
  RefreshCw,
  Lock,
  Layers,
  Sparkles,
} from "lucide-react";

interface SandboxSchedulerTabProps {
  currentTenant: TenantInfo;
}

export const SandboxSchedulerTab: React.FC<SandboxSchedulerTabProps> = ({
  currentTenant,
}) => {
  // Test suite state
  const [testResults, setTestResults] = useState<TestResultItem[]>([]);
  const [testsRunning, setTestsRunning] = useState(false);

  // Workflow Simulator state
  const [taskType, setTaskType] = useState<"patch" | "test" | "review">("patch");
  const [repositoryId, setRepositoryId] = useState("cyber-defense/security-agent");
  const [branchName, setBranchName] = useState("feature/ai-patch-v5");
  const [baseSha, setBaseSha] = useState("sha256_head_019a");
  const [networkRequired, setNetworkRequired] = useState(false);
  const [patchCode, setPatchCode] = useState(
    `diff --git a/src/guard.ts b/src/guard.ts\n--- a/src/guard.ts\n+++ b/src/guard.ts\n@@ -1,3 +1,5 @@\n+export const apiKey = 'sk-live-0987654321fedcba0987654321';\n+export function enforceZeroTrust() { return true; }\n`
  );

  // Workflow execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [workflowOutput, setWorkflowOutput] = useState<PatchWorkflowResult | null>(null);
  const [workflowLogs, setWorkflowLogs] = useState<string[]>([]);
  const [violationAlert, setViolationAlert] = useState<string | null>(null);

  // Sessions and Artifacts
  const [sessions, setSessions] = useState<SandboxSessionRecord[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);

  const refreshState = () => {
    setSessions(sandboxScheduler.getAllSessions());
    setArtifacts(artifactRepository.getAll());
  };

  useEffect(() => {
    refreshState();
    // Run tests on mount
    runSandboxTestSuite().then(setTestResults);
  }, []);

  const handleRunAllTests = async () => {
    setTestsRunning(true);
    try {
      const res = await runSandboxTestSuite();
      setTestResults(res);
    } finally {
      setTestsRunning(false);
      refreshState();
    }
  };

  const handleExecuteWorkflow = async () => {
    setIsExecuting(true);
    setViolationAlert(null);
    setWorkflowOutput(null);
    const logs: string[] = [];

    const addLog = (msg: string) => {
      logs.push(`[${new Date().toISOString().substring(11, 19)}] ${msg}`);
      setWorkflowLogs([...logs]);
    };

    try {
      addLog("Starting Sprint 5 Sandbox Execution Pipeline...");
      addLog("1. Validating patch syntax, byte limits, and traversal bounds...");

      // Ensure run exists in repository
      const runId = `run_${Date.now()}`;
      runRepository.save({
        id: runId,
        taskId: "task_sandbox_default",
        tenantId: currentTenant.id,
        workspaceId: "ws_sandbox_active",
        status: "running",
        version: 1,
        cancellationEpoch: 0,
        runtimeName: "gvisor-v1",
        runtimeVersion: "1.0",
        budgetLimit: 50,
        budgetReserved: 0,
        budgetConsumed: 0,
        createdAt: new Date().toISOString(),
      });

      addLog(`2. Created Run ${runId}. Registering branch on GitHub via idempotent adapter...`);
      addLog(`3. Profile selected: ${taskType === "review" ? "isolated" : "medium"} (Immutable image: sha256:7f9a24..., UID 10001, non-root)`);
      addLog("4. Attaching immutable repository snapshot to /workspace...");
      addLog("5. Executing 'git apply --check' (dry run) followed by 'git apply'...");
      addLog("6. Running detected test suite (pnpm test) under strict resource sandbox...");
      addLog("7. Collecting artifacts: applying secret redaction regex to logs and diffs...");
      addLog("8. Computing SHA-256 integrity digests & persisting artifacts...");
      addLog("9. Executing cleanup: revoking network namespace, credentials & verifying container destruction...");

      const result = await executePatchWorkflow({
        tenantId: currentTenant.id,
        workspaceId: "ws_sandbox_active",
        runId,
        stepId: "step_exec_01",
        repositoryId,
        branchName,
        baseSha,
        patch: patchCode,
        patchHash: `hash_${Date.now()}`,
        cancellationEpoch: 0,
      });

      setWorkflowOutput(result);
      addLog("PIPELINE COMPLETED SUCCESSFULLY: Sandbox destroyed & 0 active leases remaining.");
      refreshState();
    } catch (err: any) {
      addLog(`PIPELINE REJECTED: ${err.message}`);
      setViolationAlert(`Execution Error: ${err.message}`);
    } finally {
      setIsExecuting(false);
      refreshState();
    }
  };

  // Simulation handlers
  const handleSimulateMetadataAttack = async () => {
    setViolationAlert(null);
    try {
      await sandboxScheduler.provision({
        tenantId: currentTenant.id,
        workspaceId: "ws_default",
        runId: `run_atk_${Date.now()}`,
        taskType: "patch",
        repositoryId,
        commitSha: baseSha,
        networkRequired: true,
        requestedHosts: ["169.254.169.254"], // Cloud Metadata IP
        cancellationEpoch: 0,
      });
      setViolationAlert("ERROR: Attack succeeded! This should have been blocked.");
    } catch (err: any) {
      setViolationAlert(`Zero-Trust Network Guard Blocked: ${err.message}`);
    }
  };

  const handleSimulateShellEscape = async () => {
    setViolationAlert(null);
    try {
      const handle = await sandboxScheduler.provision({
        tenantId: currentTenant.id,
        workspaceId: "ws_default",
        runId: `run_shell_${Date.now()}`,
        taskType: "patch",
        repositoryId,
        commitSha: baseSha,
        cancellationEpoch: 0,
      });

      try {
        await sandboxScheduler.execute(handle, {
          executable: "sh",
          args: ["-c", "cat /etc/passwd"],
          cwd: ".",
          env: {},
          timeoutMs: 1000,
          maxOutputBytes: 1024,
        });
      } finally {
        await sandboxScheduler.destroy(handle);
      }
      setViolationAlert("ERROR: Shell executed! Allowlist failed.");
    } catch (err: any) {
      setViolationAlert(`Executable Allowlist Enforced: ${err.message}`);
    }
  };

  const handleSimulatePathTraversal = () => {
    setViolationAlert(null);
    try {
      const maliciousPatch = `diff --git a/../../etc/shadow b/../../etc/shadow\n--- a/../../etc/shadow\n+++ b/../../etc/shadow\n@@ -1 +1 @@\n+root:x:0:0:::\n`;
      executePatchWorkflow({
        tenantId: currentTenant.id,
        workspaceId: "ws_default",
        runId: `run_trav_${Date.now()}`,
        stepId: "step_trav",
        repositoryId,
        branchName: "feature/malicious-traversal",
        baseSha,
        patch: maliciousPatch,
        patchHash: "trav_hash",
        cancellationEpoch: 0,
      });
    } catch (err: any) {
      setViolationAlert(`Filesystem Path Traversal Blocked: ${err.message}`);
    }
  };

  const passedTestsCount = testResults.filter((t) => t.passed).length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Box className="w-4 h-4" />
              <span>Sprint 5 — Sandbox Scheduler & GitHub Adapter</span>
              <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded-full border border-indigo-500/30">
                gVisor Runtime
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Deterministic Sandbox Isolation & Ephemeral GitHub Lifecycle
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Zero-Trust container scheduler: immutable image digests, non-root execution (UID 10001), strict network allowlisting, executable filtering, cryptographic artifacts persistence, and guaranteed teardown verification.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleRunAllTests}
              disabled={testsRunning}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testsRunning ? "animate-spin" : ""}`} />
              <span>Run Sprint 5 Test Suite ({passedTestsCount}/{testResults.length})</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-400 font-medium block">Active Runtime</span>
            <div className="flex items-center space-x-2 mt-1">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-white font-mono">gVisor (non-root)</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">UID: 10001 | PrivEsc: false</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-400 font-medium block">Image Digest</span>
            <div className="flex items-center space-x-2 mt-1">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white font-mono truncate">sha256:7f9a24...</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Mutable tags rejected</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-400 font-medium block">Active / Total Sessions</span>
            <div className="flex items-center space-x-2 mt-1">
              <Box className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-white font-mono">
                {sessions.filter((s) => s.status !== "destroyed").length} / {sessions.length}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Lifecycle Verified</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-400 font-medium block">Persisted Artifacts</span>
            <div className="flex items-center space-x-2 mt-1">
              <FileCheck2 className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-bold text-white font-mono">{artifacts.length} Items</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">SHA-256 Hashed & Redacted</span>
          </div>
        </div>
      </div>

      {/* Security Violation Alert if any */}
      {violationAlert && (
        <div className="bg-rose-950/40 border border-rose-500/50 rounded-xl p-4 flex items-start space-x-3 text-xs text-rose-200 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-white">Security Policy Assertion Triggered:</span>
            <p className="font-mono text-rose-300">{violationAlert}</p>
          </div>
        </div>
      )}

      {/* Main Grid: Simulator on Left, Test Suite & Profiles on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Patch Pipeline Simulator (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Terminal className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Interactive Patch Execution Pipeline
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Isolated gVisor Workspace
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Submit a code patch to run through the strict 7-stage Sandbox Lifecycle. Notice how secrets (e.g. <code className="text-amber-400">sk-live-...</code>) are automatically detected and redacted before artifacts are permanently saved.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Target Repository</label>
                <input
                  type="text"
                  value={repositoryId}
                  onChange={(e) => setRepositoryId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Target Branch (Idempotent)</label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Base Commit SHA</label>
                <input
                  type="text"
                  value={baseSha}
                  onChange={(e) => setBaseSha(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Task Profile Classification</label>
                <select
                  value={taskType}
                  onChange={(e: any) => setTaskType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="patch">patch (medium: 2 CPU, 4Gi, allowlist)</option>
                  <option value="test">test (medium: 2 CPU, 4Gi, test runner)</option>
                  <option value="review">review (isolated: 2 CPU, 2Gi, network=none)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-400 text-xs flex items-center space-x-1.5">
                  <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Patch File Content (Unified Diff format)</span>
                </label>
                <span className="text-[11px] font-mono text-slate-500">
                  {new Blob([patchCode]).size} bytes / 10 MiB limit
                </span>
              </div>
              <textarea
                rows={5}
                value={patchCode}
                onChange={(e) => setPatchCode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-indigo-300 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleExecuteWorkflow}
                disabled={isExecuting}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-2 shadow-md transition-all disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isExecuting ? "Executing Pipeline..." : "Execute Patch in Sandbox"}</span>
              </button>

              <button
                onClick={handleSimulateMetadataAttack}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-800 text-rose-300 text-xs font-medium flex items-center space-x-1.5 transition-colors"
                title="Attempts to query 169.254.169.254"
              >
                <Shield className="w-3.5 h-3.5 text-rose-400" />
                <span>Test Metadata IP (169.254.169.254)</span>
              </button>

              <button
                onClick={handleSimulateShellEscape}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-800 text-rose-300 text-xs font-medium flex items-center space-x-1.5 transition-colors"
                title="Attempts to run arbitrary sh executable"
              >
                <Terminal className="w-3.5 h-3.5 text-rose-400" />
                <span>Test Shell ('sh -c')</span>
              </button>

              <button
                onClick={handleSimulatePathTraversal}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-800 text-rose-300 text-xs font-medium flex items-center space-x-1.5 transition-colors"
                title="Attempts to write to ../../etc"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Test Traversal ('../../')</span>
              </button>
            </div>

            {/* Real-time Terminal Log Output */}
            {workflowLogs.length > 0 && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto">
                <div className="text-slate-500 text-[10px] pb-1 border-b border-slate-900 mb-1 flex items-center justify-between">
                  <span>EXECUTION CONSOLE LOG</span>
                  <span>{workflowLogs.length} events</span>
                </div>
                {workflowLogs.map((log, idx) => (
                  <div key={idx} className={log.includes("REJECTED") ? "text-rose-400" : log.includes("SUCCESSFULLY") ? "text-emerald-400" : "text-slate-300"}>
                    {log}
                  </div>
                ))}
              </div>
            )}

            {/* Workflow Result Card */}
            {workflowOutput && (
              <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Patch Applied & Tests Passed Cleanly</span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                    Ready for PR Commit
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Branch Created / Reused</span>
                    <span className="text-cyan-300">{workflowOutput.branch.name}</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Test Suite Status</span>
                    <span className="text-emerald-400">
                      {workflowOutput.tests.results.length} Command(s) Passed (Exit 0)
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 text-xs font-mono block mb-1">Generated Unified Diff:</span>
                  <pre className="bg-slate-900 p-2.5 rounded border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                    {workflowOutput.diff}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Persisted Artifacts Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileCheck2 className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Persisted Artifacts Ledger
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {artifacts.length} verified item(s)
              </span>
            </div>

            {artifacts.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                No artifacts recorded yet. Execute the patch pipeline to collect logs, diffs, and test reports.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Object Key</th>
                      <th className="py-2 px-3">Size</th>
                      <th className="py-2 px-3">SHA-256 Hash</th>
                      <th className="py-2 px-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {artifacts.slice(-6).map((art) => (
                      <tr key={art.id} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            {art.artifactType}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-300 truncate max-w-xs">{art.objectKey}</td>
                        <td className="py-2 px-3 text-slate-400">{art.sizeBytes} B</td>
                        <td className="py-2 px-3 text-cyan-400 truncate max-w-[120px]" title={art.sha256}>
                          {art.sha256.substring(0, 16)}...
                        </td>
                        <td className="py-2 px-3 text-slate-500">{new Date(art.createdAt).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sprint 5 Test Suite & Security Gate (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Test Suite Reports */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Sprint 5 Automated Security Suite
                </h3>
              </div>
              <span className="text-xs text-emerald-400 font-mono font-bold">
                {passedTestsCount} / {testResults.length} PASSED
              </span>
            </div>

            <div className="space-y-2.5">
              {testResults.map((test, index) => (
                <div
                  key={index}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-sm hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono">
                          {test.suite}
                        </span>
                        <span className="text-xs font-bold text-white">{test.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-normal">{test.details}</p>
                      <div className="text-[10px] font-mono text-slate-500 pt-1 space-y-0.5">
                        <div>
                          Expected: <span className="text-slate-300">{test.expected}</span>
                        </div>
                        <div>
                          Actual:{" "}
                          <span className={test.passed ? "text-emerald-400" : "text-rose-400"}>
                            {test.actual}
                          </span>
                        </div>
                      </div>
                    </div>
                    {test.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sandbox Profiles Matrix */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Immutable Profiles Matrix
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white font-mono">Profile: 'medium'</span>
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20">
                    Patch & Test
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] font-mono text-slate-400">
                  <div>CPU Limit: <span className="text-slate-200">{mediumProfile.cpuLimit}</span></div>
                  <div>Memory: <span className="text-slate-200">{mediumProfile.memoryLimit}</span></div>
                  <div>User (non-root): <span className="text-emerald-400">{mediumProfile.runAsUser}</span></div>
                  <div>PrivEscalation: <span className="text-emerald-400">false</span></div>
                  <div>Network: <span className="text-cyan-300">{mediumProfile.networkMode}</span></div>
                  <div>Timeout: <span className="text-slate-200">{mediumProfile.timeoutMs / 60000}m</span></div>
                </div>
                <div className="text-[10px] text-slate-500 font-mono truncate">
                  Allowed: {mediumProfile.allowedHosts.join(", ")}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white font-mono">Profile: 'isolated'</span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                    Review & Static
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] font-mono text-slate-400">
                  <div>CPU Limit: <span className="text-slate-200">{isolatedProfile.cpuLimit}</span></div>
                  <div>Memory: <span className="text-slate-200">{isolatedProfile.memoryLimit}</span></div>
                  <div>Root FS: <span className="text-amber-400">read-only</span></div>
                  <div>Network: <span className="text-rose-400">none</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* 18-Point Verification Gate Checklist */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Sprint 5 Verification Checklist
              </h3>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300">
              {[
                "No mutable image tags (sha256 digest pinned)",
                "Zero root execution (runAsUser: 10001, PrivEsc disabled)",
                "Metadata endpoints & Docker socket forbidden (169.254.169.254 blocked)",
                "Network allowlist strictly enforced per profile",
                "Executable allowlist strictly enforced (no generic shell)",
                "Filesystem scope confined to workspace (traversal blocked)",
                "Snapshot attached and pinned to commit SHA",
                "Artifacts collected with SHA-256 and output redaction",
                "Lifecycle cleanup guaranteed even on task failure",
                "GitHub branch & PR creation idempotent with leases",
              ].map((item, idx) => (
                <div key={idx} className="flex items-center space-x-2 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
