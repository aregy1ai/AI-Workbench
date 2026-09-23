/**
 * AI Workbench - Agent & Tool Lifecycle Automation
 * Sprint 13: Platform Intelligence & Autonomous Operations
 */

import { auditLedger } from "../../audit/src/ledger";

export type AgentLifecycleState =
  | "draft"
  | "security_review"
  | "eval_ready"
  | "canary"
  | "active"
  | "restricted"
  | "deprecated"
  | "retired";

export interface AgentLifecycleProfile {
  agentId: string;
  name: string;
  version: string;
  owner: string;
  state: AgentLifecycleState;
  runtimeVersion: string;
  securityRejectionRate: number; // 0..1
  failureRate: number;           // 0..1
  costPerRunUsd: number;
  lastActiveAt: string;
  restrictionReason?: string;
  history: { state: AgentLifecycleState; timestamp: string; reason: string }[];
}

export interface ToolVerificationManifest {
  toolId: string;
  name: string;
  version: string;
  owner: string;
  signatureValid: boolean;
  manifestVersionValid: boolean;
  networkAllowlistStrict: boolean;
  noSecretOutput: boolean;
  idempotencySupported: boolean;
  hasCostAndTimeoutLimits: boolean;
  sandboxTestsPassed: boolean;
  killSwitchActive: boolean;
}

export class LifecycleAutomationManager {
  private agents: Map<string, AgentLifecycleProfile> = new Map();
  private tools: Map<string, ToolVerificationManifest> = new Map();

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    this.agents.set("agent_code_crafter_v2", {
      agentId: "agent_code_crafter_v2",
      name: "Code Crafter Pro",
      version: "2.4.0",
      owner: "platform_core@enterprise.org",
      state: "active",
      runtimeVersion: "node22-alpine",
      securityRejectionRate: 0.002,
      failureRate: 0.03,
      costPerRunUsd: 0.22,
      lastActiveAt: new Date(Date.now() - 300_000).toISOString(),
      history: [
        { state: "draft", timestamp: "2026-08-01T00:00:00Z", reason: "Created" },
        { state: "security_review", timestamp: "2026-08-05T00:00:00Z", reason: "Security review passed" },
        { state: "eval_ready", timestamp: "2026-08-10T00:00:00Z", reason: "Eval benchmark certified" },
        { state: "canary", timestamp: "2026-08-15T00:00:00Z", reason: "Canary traffic slice" },
        { state: "active", timestamp: "2026-08-20T00:00:00Z", reason: "GA release" },
      ],
    });

    this.agents.set("agent_legacy_scripter_v1", {
      agentId: "agent_legacy_scripter_v1",
      name: "Legacy Shell Scripter",
      version: "1.0.1",
      owner: "unassigned",
      state: "restricted",
      runtimeVersion: "python3.8-deprecated",
      securityRejectionRate: 0.095, // Above 5% threshold
      failureRate: 0.24,           // Above 15% threshold
      costPerRunUsd: 0.85,
      lastActiveAt: new Date(Date.now() - 86400_000 * 45).toISOString(),
      restrictionReason: "Excessive security rejections (9.5%), deprecated runtime and unassigned owner",
      history: [
        { state: "active", timestamp: "2026-01-01T00:00:00Z", reason: "Initial launch" },
        { state: "restricted", timestamp: "2026-09-10T00:00:00Z", reason: "Exceeded security threshold" },
      ],
    });

    this.tools.set("tool_git_commit", {
      toolId: "tool_git_commit",
      name: "Git Workspace Commit",
      version: "1.2.0",
      owner: "infra@enterprise.org",
      signatureValid: true,
      manifestVersionValid: true,
      networkAllowlistStrict: true,
      noSecretOutput: true,
      idempotencySupported: true,
      hasCostAndTimeoutLimits: true,
      sandboxTestsPassed: true,
      killSwitchActive: false,
    });

    this.tools.set("tool_network_curl", {
      toolId: "tool_network_curl",
      name: "Raw Network Egress Tool",
      version: "0.9.0",
      owner: "unverified_thirdparty",
      signatureValid: false, // Invalid signature
      manifestVersionValid: true,
      networkAllowlistStrict: false, // Open egress
      noSecretOutput: true,
      idempotencySupported: false,
      hasCostAndTimeoutLimits: false,
      sandboxTestsPassed: false,
      killSwitchActive: true,
    });
  }

  /**
   * Evaluates an agent's operational metrics and enforces state transitions
   */
  public evaluateAgentHealth(agentId: string): {
    state: AgentLifecycleState;
    restricted: boolean;
    reason?: string;
  } {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    if (agent.state === "retired") {
      return { state: "retired", restricted: true, reason: "Agent is permanently retired" };
    }

    // Health condition 1: Security rejection rate > 5%
    if (agent.securityRejectionRate > 0.05) {
      this.transitionAgentState(
        agentId,
        "restricted",
        `AUTO_RESTRICTION: Security rejection rate (${(agent.securityRejectionRate * 100).toFixed(1)}%) breached 5% ceiling`
      );
      return { state: "restricted", restricted: true, reason: agent.restrictionReason };
    }

    // Health condition 2: High failure rate > 15%
    if (agent.failureRate > 0.15) {
      this.transitionAgentState(
        agentId,
        "restricted",
        `AUTO_RESTRICTION: Failure rate (${(agent.failureRate * 100).toFixed(1)}%) breached 15% SLA ceiling`
      );
      return { state: "restricted", restricted: true, reason: agent.restrictionReason };
    }

    // Health condition 3: No owner
    if (!agent.owner || agent.owner === "unassigned") {
      this.transitionAgentState(
        agentId,
        "restricted",
        "AUTO_RESTRICTION: Agent has no verified human owner"
      );
      return { state: "restricted", restricted: true, reason: agent.restrictionReason };
    }

    return { state: agent.state, restricted: false };
  }

  public transitionAgentState(agentId: string, newState: AgentLifecycleState, reason: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    agent.state = newState;
    if (newState === "restricted") {
      agent.restrictionReason = reason;
    }
    agent.history.push({ state: newState, timestamp: new Date().toISOString(), reason });

    auditLedger.record({
      tenantId: "system_governance",
      eventType: "AGENT_LIFECYCLE_STATE_TRANSITION",
      actorId: "lifecycle_manager",
      actorType: "system",
      details: { agentId, newState, reason },
    });
  }

  /**
   * Verifies tool manifest against all 7 strict automated compliance gates
   */
  public verifyToolCompliance(toolId: string): {
    isCompliant: boolean;
    failingGates: string[];
  } {
    const tool = this.tools.get(toolId);
    if (!tool) throw new Error(`Tool ${toolId} not found`);

    const failingGates: string[] = [];

    if (!tool.signatureValid) failingGates.push("Invalid Cryptographic Signature");
    if (!tool.manifestVersionValid) failingGates.push("Unsupported Manifest Version");
    if (!tool.networkAllowlistStrict) failingGates.push("Missing Network Allowlist / Unrestricted Egress");
    if (!tool.noSecretOutput) failingGates.push("Secret Leakage in Output Schema");
    if (!tool.idempotencySupported) failingGates.push("Missing Idempotency Barrier");
    if (!tool.hasCostAndTimeoutLimits) failingGates.push("Missing Cost or Timeout Guards");
    if (!tool.sandboxTestsPassed) failingGates.push("Failed Containerized Sandbox Test Suite");
    if (tool.killSwitchActive) failingGates.push("Tool Emergency Kill Switch is Engaged");

    const isCompliant = failingGates.length === 0;

    auditLedger.record({
      tenantId: "system_marketplace",
      eventType: "TOOL_COMPLIANCE_VERIFIED",
      actorId: "lifecycle_manager",
      actorType: "system",
      details: { toolId, isCompliant, failingGates },
    });

    return { isCompliant, failingGates };
  }

  public getAgents(): AgentLifecycleProfile[] {
    return Array.from(this.agents.values());
  }

  public getTools(): ToolVerificationManifest[] {
    return Array.from(this.tools.values());
  }
}

export const lifecycleAutomationManager = new LifecycleAutomationManager();
