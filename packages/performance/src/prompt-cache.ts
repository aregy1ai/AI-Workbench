/**
 * AI Workbench - Prompt Prefix Caching & Task-Adaptive Model Routing
 * v2 Architecture: Performance, Speed & Efficiency (§6.2, §6.6)
 */

import { auditLedger } from "../../audit/src/ledger";

export interface PromptCacheEntry {
  prefixHash: string;
  prefixSnippet: string;
  tokenCount: number;
  hitCount: number;
  savedCostDollars: number;
  cachedAt: number;
}

export type TaskType = "planning" | "coding" | "review" | "simple";

export interface ModelRouteDecision {
  taskType: TaskType;
  selectedModel: string;
  provider: "openai" | "anthropic" | "gemini" | "deepseek";
  estimatedLatencyMs: number;
  costPer1kTokens: number;
  selectionRationale: string;
  promptCacheApplied: boolean;
  effectiveTokensSaved: number;
}

export class PromptCacheAndRoutingEngine {
  private cacheEntries: Map<string, PromptCacheEntry> = new Map();

  constructor() {
    this.seedCache();
  }

  private seedCache() {
    // Seed common system prompt & static repository context prefix
    const staticSysPrompt = "SYSTEM: You are the AI Workbench Agent operating under strict guarded autonomy. Respect policy AST invariants.";
    const prefixHash = `pfx_sys_${Math.random().toString(36).substring(2, 9)}`;

    this.cacheEntries.set(prefixHash, {
      prefixHash,
      prefixSnippet: staticSysPrompt,
      tokenCount: 4500, // 4.5k tokens cached prefix
      hitCount: 138,
      savedCostDollars: 4.14,
      cachedAt: Date.now() - 7200000,
    });
  }

  /**
   * Intelligently routes the task to the fastest & most cost-effective model
   * depending on task complexity and checks for cached prompt prefix hit
   */
  public routeModelRequest(taskType: TaskType, promptContent: string): ModelRouteDecision {
    // Check if prompt prefix is cached
    let cacheHit = false;
    let savedTokens = 0;

    for (const entry of this.cacheEntries.values()) {
      if (promptContent.startsWith(entry.prefixSnippet) || promptContent.includes(entry.prefixSnippet)) {
        cacheHit = true;
        savedTokens = entry.tokenCount;
        entry.hitCount++;
        entry.savedCostDollars += 0.03;
        break;
      }
    }

    let selectedModel: string;
    let provider: "openai" | "anthropic" | "gemini" | "deepseek";
    let estimatedLatencyMs: number;
    let costPer1kTokens: number;
    let selectionRationale: string;

    switch (taskType) {
      case "planning":
        // High-reasoning model for multi-step DAG planning
        selectedModel = "claude-3-7-sonnet";
        provider = "anthropic";
        estimatedLatencyMs = cacheHit ? 420 : 850;
        costPer1kTokens = 0.003;
        selectionRationale = "Deep multi-step reasoning model required for decomposition and dependency DAG planning";
        break;

      case "coding":
        // Specialized high-velocity code generation
        selectedModel = "codex-deepseek-coder";
        provider = "deepseek";
        estimatedLatencyMs = cacheHit ? 350 : 720;
        costPer1kTokens = 0.0008;
        selectionRationale = "High-velocity specialized coding model selected for differential patch generation";
        break;

      case "review":
        // Large context window for whole-repo diff comparison
        selectedModel = "gemini-2.5-flash";
        provider = "gemini";
        estimatedLatencyMs = cacheHit ? 280 : 540;
        costPer1kTokens = 0.0004;
        selectionRationale = "Low-cost high-throughput massive context window model selected for diff review and AST audit";
        break;

      case "simple":
      default:
        // Ultra-low latency mini model for short classification
        selectedModel = "gpt-4o-mini";
        provider = "openai";
        estimatedLatencyMs = cacheHit ? 180 : 340;
        costPer1kTokens = 0.00015;
        selectionRationale = "Ultra-fast mini model for lightweight classification and status summaries";
        break;
    }

    const decision: ModelRouteDecision = {
      taskType,
      selectedModel,
      provider,
      estimatedLatencyMs,
      costPer1kTokens,
      selectionRationale,
      promptCacheApplied: cacheHit,
      effectiveTokensSaved: savedTokens,
    };

    auditLedger.record({
      tenantId: "system_routing",
      eventType: "MODEL_ROUTE_OPTIMIZED",
      actorId: "prompt_cache_engine",
      actorType: "system",
      details: {
        taskType,
        selectedModel,
        provider,
        promptCacheApplied: cacheHit,
        effectiveTokensSaved: savedTokens,
      },
    });

    return decision;
  }

  public getCacheEntries(): PromptCacheEntry[] {
    return Array.from(this.cacheEntries.values());
  }

  public registerPrefixCache(prefixSnippet: string, tokenCount: number): PromptCacheEntry {
    const prefixHash = `pfx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const entry: PromptCacheEntry = {
      prefixHash,
      prefixSnippet,
      tokenCount,
      hitCount: 0,
      savedCostDollars: 0,
      cachedAt: Date.now(),
    };
    this.cacheEntries.set(prefixHash, entry);
    return entry;
  }
}

export const promptCacheAndRoutingEngine = new PromptCacheAndRoutingEngine();
