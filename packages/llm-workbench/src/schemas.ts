/**
 * AI Workbench - Schema Registry for LLM Workbench
 * Registers schemas for Artifacts and Rules used in Agent Workflows
 */

import { SchemaRegistry, type JsonSchema } from "@llm-workbench/runtime";

export const ARTIFACT_SCHEMAS: Record<string, JsonSchema> = {
  agent_plan: {
    type: "object",
    properties: {
      goal: { type: "string" },
      steps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            stepId: { type: "string" },
            action: { type: "string" },
            requiredTools: { type: "array", items: { type: "string" } },
            estimatedCostUsd: { type: "number" }
          },
          required: ["stepId", "action"]
        }
      },
      riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"] }
    },
    required: ["goal", "steps", "riskLevel"]
  },

  prompt_spec: {
    type: "object",
    properties: {
      template: { type: "string" },
      systemInstruction: { type: "string" },
      variables: { type: "object" },
      model: { type: "string" },
      temperature: { type: "number" },
      maxOutputTokens: { type: "number" }
    },
    required: ["template", "model"]
  },

  model_completion: {
    type: "object",
    properties: {
      model: { type: "string" },
      content: { type: "string" },
      promptTokens: { type: "number" },
      completionTokens: { type: "number" },
      totalTokens: { type: "number" },
      costUsd: { type: "number" },
      latencyMs: { type: "number" },
      finishReason: { type: "string" }
    },
    required: ["model", "content", "totalTokens", "costUsd", "latencyMs"]
  },

  security_scan: {
    type: "object",
    properties: {
      passed: { type: "boolean" },
      promptInjectionScore: { type: "number" },
      piiDetected: { type: "array", items: { type: "string" } },
      threatCategory: { type: "string" },
      sandboxIsolated: { type: "boolean" },
      recommendations: { type: "array", items: { type: "string" } }
    },
    required: ["passed", "promptInjectionScore", "sandboxIsolated"]
  },

  human_review_package: {
    type: "object",
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      proposedChanges: { type: "string" },
      riskAssessment: { type: "string" },
      requestedByAgent: { type: "string" },
      requiresRoles: { type: "array", items: { type: "string" } }
    },
    required: ["title", "summary", "riskAssessment"]
  },

  audit_certificate: {
    type: "object",
    properties: {
      certificateId: { type: "string" },
      runId: { type: "string" },
      previousHash: { type: "string" },
      merkleRoot: { type: "string" },
      signature: { type: "string" },
      algorithm: { type: "string" },
      timestamp: { type: "string" },
      tamperEvident: { type: "boolean" }
    },
    required: ["certificateId", "runId", "merkleRoot", "signature", "tamperEvident"]
  }
};

export const RULE_SCHEMAS: Record<string, JsonSchema> = {
  budget_guardrail: {
    type: "object",
    properties: {
      maxCostUsd: { type: "number" },
      maxTokens: { type: "number" },
      hardStop: { type: "boolean" },
      notifyThresholdPercent: { type: "number" }
    },
    required: ["maxCostUsd", "hardStop"]
  },

  latency_sla: {
    type: "object",
    properties: {
      targetP95Ms: { type: "number" },
      timeoutMs: { type: "number" },
      retryPolicy: { type: "string", enum: ["exponential_backoff", "circuit_break", "fail_fast"] }
    },
    required: ["timeoutMs"]
  },

  security_policy: {
    type: "object",
    properties: {
      allowInternetAccess: { type: "boolean" },
      redactPii: { type: "boolean" },
      enforceHashChaining: { type: "boolean" },
      allowedTools: { type: "array", items: { type: "string" } }
    },
    required: ["redactPii", "enforceHashChaining"]
  },

  human_approval_gate: {
    type: "object",
    properties: {
      gateType: { type: "string", enum: ["PAUSE_BEFORE", "PAUSE_AFTER", "CHECKPOINT"] },
      requiredRole: { type: "string" },
      minApprovers: { type: "number" },
      timeoutHours: { type: "number" },
      autoActionOnTimeout: { type: "string", enum: ["reject", "escalate", "pause"] }
    },
    required: ["gateType", "requiredRole"]
  }
};

export function createWorkbenchSchemaRegistry(): SchemaRegistry {
  const registry = new SchemaRegistry();

  // Register all artifact types
  for (const [id, schema] of Object.entries(ARTIFACT_SCHEMAS)) {
    registry.registerArtifactType({
      id,
      schema,
      // Redact sensitive security paths if exported in user profile
      exportRedactPaths: id === "security_scan" ? ["/piiDetected"] : []
    });
  }

  // Register all rule schemas
  for (const [id, schema] of Object.entries(RULE_SCHEMAS)) {
    registry.registerRulePayloadSchema({
      id,
      schema
    });
  }

  return registry;
}
