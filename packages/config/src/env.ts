/**
 * AI Workbench - Configuration and Environment Settings
 * Phase: Sprint 1 Configuration Package
 */

export interface WorkbenchConfig {
  env: "development" | "staging" | "production" | "test";
  port: number;
  databaseUrl: string;
  redisUrl: string;
  objectStorageEndpoint: string;
  objectStorageBucket: string;
  signingSecret: string;
  llmDefaultTimeoutMs: number;
  sandboxDefaultTimeoutMs: number;
  maxBudgetPerRun: number;
  defaultRuntime: string;
  defaultRuntimeVersion: string;
}

export const defaultConfig: WorkbenchConfig = {
  env: (typeof process !== "undefined" && process.env?.NODE_ENV as any) || "development",
  port: 3000,
  databaseUrl: (typeof process !== "undefined" && process.env?.DATABASE_URL) || "postgresql://postgres:postgres@localhost:5432/ai_workbench",
  redisUrl: (typeof process !== "undefined" && process.env?.REDIS_URL) || "redis://localhost:6379",
  objectStorageEndpoint: (typeof process !== "undefined" && process.env?.S3_ENDPOINT) || "http://localhost:9000",
  objectStorageBucket: "ai-workbench-artifacts",
  signingSecret: (typeof process !== "undefined" && process.env?.JWT_SIGNING_SECRET) || "dev-workbench-secret-control-plane-2026-strict-key-99",
  llmDefaultTimeoutMs: 30000,
  sandboxDefaultTimeoutMs: 1200000, // 20m
  maxBudgetPerRun: 25.0, // USD
  defaultRuntime: "standard-code-agent",
  defaultRuntimeVersion: "1.0.0",
};

export function loadConfig(overrides?: Partial<WorkbenchConfig>): WorkbenchConfig {
  return {
    ...defaultConfig,
    ...overrides,
  };
}
