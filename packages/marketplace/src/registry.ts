/**
 * AI Workbench - Tool Marketplace & Certification Registry
 * Sprint 11: General Availability & Ecosystem Platform
 */

import { auditLedger } from "../../audit/src/ledger";

export interface ToolManifest {
  name: string;
  version: string;
  publisher: string;
  capabilities: string[];
  requiredPermissions: string[];
  networkAllowlist: string[];
  secretRequirements: string[];
  maxRuntimeMs: number;
  maxCost: number;
  dataClassification: "public" | "internal" | "restricted";
  description?: string;
  signature?: string;
}

export type MarketplaceStatus =
  | "submitted"
  | "security_review"
  | "sandbox_tested"
  | "canary"
  | "published"
  | "suspended"
  | "deprecated";

export interface CertifiedToolRecord {
  id: string;
  manifest: ToolManifest;
  status: MarketplaceStatus;
  isKilled: boolean;
  allowedTenants: string[]; // empty means all tenants allowed if published
  reviewNotes: string[];
  securityScore: number;
  submittedAt: string;
  publishedAt?: string;
}

export class ToolMarketplaceRegistry {
  private tools: Map<string, CertifiedToolRecord> = new Map();

  constructor() {
    this.seedStandardTools();
  }

  private seedStandardTools(): void {
    const defaultTools: ToolManifest[] = [
      {
        name: "repo.ast_grep",
        version: "1.2.0",
        publisher: "Workbench Core Team",
        capabilities: ["code_search", "ast_analysis"],
        requiredPermissions: ["repo.read"],
        networkAllowlist: [],
        secretRequirements: [],
        maxRuntimeMs: 15000,
        maxCost: 0.05,
        dataClassification: "internal",
        description: "Fast semantic AST structural pattern matching across repositories.",
      },
      {
        name: "docker.layer_analyzer",
        version: "1.0.4",
        publisher: "DevSecOps Partner",
        capabilities: ["container_audit", "vulnerability_scan"],
        requiredPermissions: ["sandbox.execute"],
        networkAllowlist: ["registry.hub.docker.com"],
        secretRequirements: [],
        maxRuntimeMs: 45000,
        maxCost: 0.15,
        dataClassification: "internal",
        description: "Static security scanner for Docker layers and package SBOMs.",
      },
      {
        name: "linear.ticket_syncer",
        version: "2.1.0",
        publisher: "Productivity Inc.",
        capabilities: ["issue_tracking", "status_sync"],
        requiredPermissions: ["integration.linear"],
        networkAllowlist: ["api.linear.app"],
        secretRequirements: ["LINEAR_API_KEY"],
        maxRuntimeMs: 10000,
        maxCost: 0.02,
        dataClassification: "restricted",
        description: "Sync PR review statuses with customer Linear workspace issues.",
      },
    ];

    for (const tool of defaultTools) {
      const id = `${tool.name}@${tool.version}`;
      this.tools.set(id, {
        id,
        manifest: tool,
        status: "published",
        isKilled: false,
        allowedTenants: ["*"],
        reviewNotes: ["Passed full static and sandbox security reviews."],
        securityScore: 98,
        submittedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
      });
    }
  }

  public submitTool(manifest: ToolManifest, tenantId: string): CertifiedToolRecord {
    // 1. Validation check
    if (!manifest.name || !manifest.version || !manifest.publisher) {
      throw new Error("MANIFEST_VALIDATION_FAILED: Missing mandatory fields");
    }

    if (manifest.maxRuntimeMs > 300_000) {
      throw new Error("MANIFEST_POLICY_VIOLATION: maxRuntimeMs exceeds 5 minute sandbox boundary");
    }

    if (manifest.networkAllowlist.includes("*")) {
      throw new Error("MANIFEST_SECURITY_DENIAL: Wildcard network egress '*' is forbidden");
    }

    const id = `${manifest.name}@${manifest.version}`;
    const record: CertifiedToolRecord = {
      id,
      manifest,
      status: "submitted",
      isKilled: false,
      allowedTenants: [tenantId],
      reviewNotes: ["Automated intake verification passed. Queued for security sandbox scan."],
      securityScore: 85,
      submittedAt: new Date().toISOString(),
    };

    this.tools.set(id, record);

    auditLedger.record({
      runId: "sys_marketplace",
      stepId: "step_tool_submit",
      eventType: "marketplace.tool_submitted",
      tenantId,
      actorType: "publisher",
      actorId: manifest.publisher,
      details: { toolId: id, name: manifest.name, version: manifest.version },
    });

    return record;
  }

  public advanceStage(
    toolId: string,
    targetStage: MarketplaceStatus,
    reviewerId: string,
    note?: string
  ): CertifiedToolRecord {
    const tool = this.tools.get(toolId);
    if (!tool) throw new Error(`Tool not found: ${toolId}`);

    tool.status = targetStage;
    if (note) tool.reviewNotes.push(`[${targetStage}] ${note}`);
    if (targetStage === "published") {
      tool.publishedAt = new Date().toISOString();
    }

    auditLedger.record({
      runId: "sys_marketplace",
      stepId: "step_tool_stage",
      eventType: "marketplace.stage_advanced",
      tenantId: tool.allowedTenants[0] || "global",
      actorType: "security_reviewer",
      actorId: reviewerId,
      details: { toolId, targetStage, note },
    });

    return tool;
  }

  public setKillSwitch(toolId: string, killed: boolean, reason: string): CertifiedToolRecord {
    const tool = this.tools.get(toolId);
    if (!tool) throw new Error(`Tool not found: ${toolId}`);

    tool.isKilled = killed;
    tool.reviewNotes.push(
      `[KILL_SWITCH] Set to ${killed ? "ACTIVE (BLOCKED)" : "DISABLED (RESTORED)"}: ${reason}`
    );

    auditLedger.record({
      runId: "sys_marketplace",
      stepId: "step_kill_switch",
      eventType: "marketplace.kill_switch_toggled",
      tenantId: "global",
      actorType: "security_admin",
      actorId: "sec_ops",
      details: { toolId, killed, reason },
    });

    return tool;
  }

  public isToolExecutable(toolName: string, tenantId: string): { allowed: boolean; reason?: string } {
    // Find latest published version
    const candidates = Array.from(this.tools.values()).filter(
      (t) => t.manifest.name === toolName
    );

    if (candidates.length === 0) {
      return { allowed: false, reason: "TOOL_NOT_FOUND_IN_MARKETPLACE" };
    }

    const latest = candidates[candidates.length - 1];

    if (latest.isKilled) {
      return { allowed: false, reason: "TOOL_KILL_SWITCH_ACTIVE" };
    }

    if (latest.status !== "published" && latest.status !== "canary") {
      return { allowed: false, reason: `TOOL_NOT_PUBLISHED: status is ${latest.status}` };
    }

    if (
      !latest.allowedTenants.includes("*") &&
      !latest.allowedTenants.includes(tenantId)
    ) {
      return { allowed: false, reason: "TENANT_NOT_IN_TOOL_ALLOWLIST" };
    }

    return { allowed: true };
  }

  public listTools(): CertifiedToolRecord[] {
    return Array.from(this.tools.values());
  }
}

export const toolMarketplace = new ToolMarketplaceRegistry();
