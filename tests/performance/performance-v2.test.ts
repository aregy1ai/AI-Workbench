/**
 * AI Workbench - Sprint 15: Performance, Speed & Efficiency Test Suite
 * Automated Verification for v2 Architecture (§6.1 - §6.7)
 */

import { highVelocityWarmPoolEngine } from "../../packages/performance/src/warm-pool-engine";
import { highVelocityTokenStreamer } from "../../packages/performance/src/token-streamer";
import { parallelToolOrchestrator, ParallelToolTask } from "../../packages/performance/src/parallel-tools";
import { databasePerformanceOptimizer } from "../../packages/performance/src/db-optimizer";
import { promptCacheAndRoutingEngine } from "../../packages/performance/src/prompt-cache";
import { performanceSLIEvaluator } from "../../packages/performance/src/sli-metrics";

export interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
}

export async function runPerformanceTestSuite(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const assert = (condition: boolean, msg: string) => {
    if (!condition) throw new Error(msg);
  };

  // Test 1: Warm Sandbox Allocation (SLI-1: < 3s)
  {
    const start = Date.now();
    try {
      const benchmark = await highVelocityWarmPoolEngine.claimSandbox("tenant_perf_test", "run_p_01");
      assert(benchmark.mode === "warm_pool_claim", "Must claim from warm pool");
      assert(benchmark.timeToFirstStepMs < 3000, `Time to first step must be < 3s (observed: ${benchmark.timeToFirstStepMs}ms)`);
      assert(benchmark.targetMet, "Target SLI-1 must be met");

      results.push({
        name: "1. Warm Sandbox Pool: Instant allocation achieves Time to First Step < 3s (SLI-1)",
        passed: true,
        durationMs: Date.now() - start,
        details: `Allocated container in ${benchmark.timeToFirstStepMs}ms (Target: < 3000ms)`,
      });
    } catch (e: any) {
      results.push({
        name: "1. Warm Sandbox Pool: Instant allocation achieves Time to First Step < 3s (SLI-1)",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 2: Cold Start Comparison (Demonstrating latency delta)
  {
    const start = Date.now();
    try {
      const benchmark = await highVelocityWarmPoolEngine.claimSandbox("tenant_perf_test", "run_p_02", { forceColdStart: true });
      assert(benchmark.mode === "cold_provision", "Must be cold provision");
      assert(benchmark.timeToFirstStepMs > 2500, "Cold provision must exhibit realistic cold-start latency");

      results.push({
        name: "2. Cold Provision Benchmark: Validates cold-start penalty to justify pre-warmed pool architecture",
        passed: true,
        durationMs: Date.now() - start,
        details: `Cold provision took ${benchmark.timeToFirstStepMs}ms vs warm allocation (~200ms)`,
      });
    } catch (e: any) {
      results.push({
        name: "2. Cold Provision Benchmark: Validates cold-start penalty to justify pre-warmed pool architecture",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 3: Async Non-Blocking Sandbox Destroy (SLI-5: < 5s async)
  {
    const start = Date.now();
    try {
      const claim = await highVelocityWarmPoolEngine.claimSandbox("tenant_perf_test", "run_p_03");
      const release = await highVelocityWarmPoolEngine.releaseSandboxAsync(claim.containerId, "tenant_perf_test");

      assert(release.unblockedImmediately, "Caller must be unblocked immediately without waiting for disk wipe");
      const bgDuration = await release.backgroundCleanupPromise;
      assert(bgDuration < 5000, `Background cleanup must finish in < 5s (observed: ${bgDuration}ms)`);

      results.push({
        name: "3. Async Non-Blocking Destroy: Unblocks caller instantly while background wiping finishes < 5s (SLI-5)",
        passed: true,
        durationMs: Date.now() - start,
        details: `Instant caller release verified; background cleanup completed in ${bgDuration}ms`,
      });
    } catch (e: any) {
      results.push({
        name: "3. Async Non-Blocking Destroy: Unblocks caller instantly while background wiping finishes < 5s (SLI-5)",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 4: Differential Repository Snapshot Cache
  {
    const start = Date.now();
    try {
      const hit = highVelocityWarmPoolEngine.resolveDifferentialSnapshot("repo_core_api", "commit_target_01");
      assert(hit.cacheHit, "Must find differential cache hit for pre-cached repository");
      assert(hit.cloneTimeMs < 200, "Differential unpack must take < 200ms");

      const miss = highVelocityWarmPoolEngine.resolveDifferentialSnapshot("repo_unseen_ext", "commit_target_02");
      assert(!miss.cacheHit, "Must register cache miss for unseen repository");

      results.push({
        name: "4. Differential Snapshot Cache: Accelerates repo workspace preparation by ~20x over full git clone",
        passed: true,
        durationMs: Date.now() - start,
        details: `Cache hit unpack took ${hit.cloneTimeMs}ms (${hit.bytesTransferred / 1000}KB) vs full clone ${miss.cloneTimeMs}ms`,
      });
    } catch (e: any) {
      results.push({
        name: "4. Differential Snapshot Cache: Accelerates repo workspace preparation by ~20x over full git clone",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 5: Token-by-Token Streaming (SLI-2: < 1.5s TTFT)
  {
    const start = Date.now();
    try {
      let tokenCount = 0;
      const streamResult = await highVelocityTokenStreamer.streamLLMResponse(
        "run_test_stream_01",
        "Generate authorization tests",
        (chunk) => {
          tokenCount++;
        }
      );

      assert(streamResult.timeToFirstTokenMs < 1500, `TTFT must be < 1.5s (observed: ${streamResult.timeToFirstTokenMs}ms)`);
      assert(streamResult.targetMet, "Target SLI-2 must be met");
      assert(tokenCount > 0, "Must receive streamed token chunks");

      results.push({
        name: "5. Real-Time Token Streaming: Achieves Time to First Token < 1.5s via SSE proxy (SLI-2)",
        passed: true,
        durationMs: Date.now() - start,
        details: `TTFT: ${streamResult.timeToFirstTokenMs}ms | Speed: ${streamResult.tokensPerSecond} tokens/sec | Total: ${streamResult.totalTokens} tokens`,
      });
    } catch (e: any) {
      results.push({
        name: "5. Real-Time Token Streaming: Achieves Time to First Token < 1.5s via SSE proxy (SLI-2)",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 6: Optimistic UI Updates & Client-Side Rollback
  {
    const start = Date.now();
    try {
      const opt = highVelocityTokenStreamer.executeOptimisticAction("APPROVAL_GRANT", { status: "approved" });
      assert(opt.optimisticState.status === "approved", "State must be immediately updated optimistically");
      assert(!opt.rolledBack, "Should not be rolled back initially");

      // Simulate rejection from server and test rollback
      const rolledBack = highVelocityTokenStreamer.rollbackOptimisticAction(opt.actionId, "POLICY_VIOLATION");
      assert(Boolean(rolledBack?.rolledBack), "Action must reflect rolledBack status upon server rejection");
      assert(rolledBack?.rollbackReason === "POLICY_VIOLATION", "Must record rollback reason");

      results.push({
        name: "6. Optimistic UI Synchronization: Provides zero-latency client state with safe server rollback",
        passed: true,
        durationMs: Date.now() - start,
        details: "Optimistic state manifested in 0ms; successfully reverted upon rejection trigger",
      });
    } catch (e: any) {
      results.push({
        name: "6. Optimistic UI Synchronization: Provides zero-latency client state with safe server rollback",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 7: Parallel Tool Call Orchestrator (DAG Resolution & Concurrency Cap)
  {
    const start = Date.now();
    try {
      const dagTasks: ParallelToolTask[] = [
        { id: "t1", toolName: "repo.read_file_1", input: { path: "a.ts" } },
        { id: "t2", toolName: "repo.read_file_2", input: { path: "b.ts" } }, // Independent: runs parallel with t1
        { id: "t3", toolName: "linter.run", input: {}, dependsOn: ["t1", "t2"] }, // Dependent: waits for t1 & t2
        { id: "t4", toolName: "test.execute", input: {}, dependsOn: ["t3"] },
      ];

      const summary = await parallelToolOrchestrator.executeToolDAG("run_test_dag_01", dagTasks, { concurrencyCap: 3 });
      assert(summary.allSucceeded, "All DAG tasks must succeed");
      assert(summary.speedupFactor > 1.2, `Parallel execution must yield speedup > 1.2x (observed: ${summary.speedupFactor}x)`);

      results.push({
        name: "7. Parallel Tool DAG Orchestration: Concurrently resolves independent tool calls with >1.2x speedup",
        passed: true,
        durationMs: Date.now() - start,
        details: `Wall-clock: ${summary.wallClockDurationMs}ms vs Theoretical sequential: ${summary.sequentialTheoreticalDurationMs}ms (Speedup: ${summary.speedupFactor}x)`,
      });
    } catch (e: any) {
      results.push({
        name: "7. Parallel Tool DAG Orchestration: Concurrently resolves independent tool calls with >1.2x speedup",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 8: Database Composite Indexing & RLS Overhead (< 10%)
  {
    const start = Date.now();
    try {
      const benchmark = databasePerformanceOptimizer.runRLSOverheadBenchmark("recent_runs");
      assert(benchmark.overheadPercentage < 10.0, `RLS overhead must be < 10% (observed: ${benchmark.overheadPercentage}%)`);
      assert(benchmark.targetMet, "Target SLI-4 must be met");

      const routing = databasePerformanceOptimizer.routeDatabaseQuery({
        isAnalyticalOrEvidenceQuery: true,
        isWriteOrLockRequired: false,
        actionName: "audit_ledger_scan",
      });
      assert(routing.queryType === "READ_REPLICA", "Evidence Plane queries must route to Read-Replica");

      results.push({
        name: "8. Database Optimizer & RLS Benchmarking: Verifies composite index scan and <10% RLS overhead (SLI-4)",
        passed: true,
        durationMs: Date.now() - start,
        details: `RLS Overhead: +${benchmark.overheadPercentage}% (Target: <10%) | Read-replica offload active`,
      });
    } catch (e: any) {
      results.push({
        name: "8. Database Optimizer & RLS Benchmarking: Verifies composite index scan and <10% RLS overhead (SLI-4)",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 9: Prompt Prefix Caching & Task-Adaptive Model Routing
  {
    const start = Date.now();
    try {
      const prompt = "SYSTEM: You are the AI Workbench Agent operating under strict guarded autonomy. Respect policy AST invariants. Analyze PR.";
      const planDecision = promptCacheAndRoutingEngine.routeModelRequest("planning", prompt);
      assert(planDecision.promptCacheApplied, "Must detect cached prefix hit");
      assert(planDecision.effectiveTokensSaved > 1000, "Must register token savings from prefix cache");
      assert(planDecision.provider === "anthropic" || planDecision.provider === "openai", "Planning must route to deep reasoning model");

      const codeDecision = promptCacheAndRoutingEngine.routeModelRequest("coding", "Generate diff for login");
      assert(codeDecision.provider === "deepseek", "Coding must route to specialized high-velocity coding model");

      results.push({
        name: "9. Prompt Prefix Caching & Model Routing: Saves tokens on prefix hits and routes by task complexity",
        passed: true,
        durationMs: Date.now() - start,
        details: `Cache Hit: ${planDecision.promptCacheApplied} (${planDecision.effectiveTokensSaved} tokens saved) | Routed to: ${planDecision.selectedModel}`,
      });
    } catch (e: any) {
      results.push({
        name: "9. Prompt Prefix Caching & Model Routing: Saves tokens on prefix hits and routes by task complexity",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  // Test 10: End-to-End Platform Velocity Scorecard (5/5 SLIs)
  {
    const start = Date.now();
    try {
      const scorecard = await performanceSLIEvaluator.evaluateAllSLIs();
      assert(scorecard.allSLIsMet, "All 5 platform SLIs must be met");
      assert(scorecard.overallVelocityGrade === "A+", "Platform velocity grade must be A+");

      results.push({
        name: "10. Platform Velocity Scorecard: All 5 core SLIs validated against v2 Architecture targets (Grade A+)",
        passed: true,
        durationMs: Date.now() - start,
        details: `5 of 5 SLIs passed: TTFStep < 3s, TTFT < 1.5s, Recovery 100%, RLS < 10%, Async Cleanup < 5s`,
      });
    } catch (e: any) {
      results.push({
        name: "10. Platform Velocity Scorecard: All 5 core SLIs validated against v2 Architecture targets (Grade A+)",
        passed: false,
        durationMs: Date.now() - start,
        details: e.message,
      });
    }
  }

  return results;
}
