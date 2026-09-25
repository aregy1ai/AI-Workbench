/**
 * AI Workbench - LLM Workbench Multi-Tenant Adapter Types & Contracts
 * Phase: Control Plane Integration (inspired by @llm-workbench architecture)
 */

import type { RunStoreState, SavedRunMeta } from "@llm-workbench/runtime";
import type { TenantInfo } from "../../../src/types";

export type GateStatus = "approved" | "pending";

export interface StepGateState {
  before: GateStatus;
  after: GateStatus;
  checkpoints: Record<string, GateStatus>;
}

export interface TenantContext {
  tenantId: string;
  workspaceId?: string;
  userId: string;
  role: "admin" | "security_officer" | "developer" | "reviewer";
}

export interface SupabaseAdapterConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  serviceRoleKey?: string;
  tableNamePrefix?: string;
  enableEncryption?: boolean;
}

export interface StoredRunRecord {
  id: string;
  tenant_id: string;
  workspace_id?: string;
  workflow_id: string;
  status: string;
  started_at: string;
  ended_at?: string;
  run_state: RunStoreState;
  bundle_hash?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface WorkbenchMetrics {
  totalRuns: number;
  activeRuns: number;
  completedRuns: number;
  failedRuns: number;
  pendingGates: number;
  approvedGates: number;
  totalCostUsd: number;
  totalTokens: number;
  rulePassRate: number;
}

export interface HumanGateReviewInput {
  runId: string;
  stepId: string;
  gate: "PAUSE_BEFORE" | "PAUSE_AFTER" | "CHECKPOINT";
  decision: "approved" | "rejected" | "edited";
  reviewerNote?: string;
  reviewerId: string;
}
