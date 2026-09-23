/**
 * AI Workbench - Enterprise Policy Packs & Pre-packaged Compliance Rules
 * Sprint 11: General Availability & Ecosystem Platform
 */

import { auditLedger } from "../../audit/src/ledger";

export interface PolicyRule {
  id: string;
  name: string;
  toolPattern: string;
  action: "allow" | "deny" | "require_approval";
  conditions?: Record<string, unknown>;
}

export interface PolicyPack {
  id: string;
  version: string;
  name: string;
  description: string;
  rules: PolicyRule[];
  defaultAction: "allow" | "deny";
  requiresSecondApproval: boolean;
  status: "draft" | "active" | "retired";
  createdAt: string;
}

export const ENTERPRISE_POLICY_PACKS: PolicyPack[] = [
  {
    id: "pack_fintech_strict",
    version: "2.1.0",
    name: "FinTech & Banking Strict Guardrails",
    description: "Blocks CI/CD workflow alterations, bans external network egress, enforces 100% human sign-off on PRs.",
    rules: [
      {
        id: "rule_no_ci_workflows",
        name: "Forbid workflow modifications",
        toolPattern: "repo.write_file",
        action: "deny",
        conditions: { pathPattern: ".github/workflows/**" },
      },
      {
        id: "rule_mandatory_pr_approval",
        name: "Human PR Sign-off",
        toolPattern: "github.create_pull_request",
        action: "require_approval",
        conditions: { minApprovers: 2 },
      },
    ],
    defaultAction: "deny",
    requiresSecondApproval: true,
    status: "active",
    createdAt: new Date().toISOString(),
  },
  {
    id: "pack_healthcare_hipaa",
    version: "1.4.0",
    name: "Healthcare & HIPAA Data Residency",
    description: "Zero external network egress, data residency locked to EU/US regions, immediate kill on secrets.",
    rules: [
      {
        id: "rule_zero_egress",
        name: "Deny non-whitelisted network egress",
        toolPattern: "sandbox.network_connect",
        action: "deny",
      },
    ],
    defaultAction: "deny",
    requiresSecondApproval: true,
    status: "active",
    createdAt: new Date().toISOString(),
  },
  {
    id: "pack_standard_saas",
    version: "1.0.0",
    name: "Standard Agile SaaS Development",
    description: "Permissive read-only investigation, approval required for external PR and branch deletion.",
    rules: [
      {
        id: "rule_allow_read",
        name: "Allow codebase reading",
        toolPattern: "repo.read_file",
        action: "allow",
      },
      {
        id: "rule_pr_approval",
        name: "Review pull requests",
        toolPattern: "github.create_pull_request",
        action: "require_approval",
      },
    ],
    defaultAction: "allow",
    requiresSecondApproval: false,
    status: "active",
    createdAt: new Date().toISOString(),
  },
];

export class PolicyPackManager {
  private activePacks: Map<string, PolicyPack> = new Map();

  constructor() {
    this.activePacks.set("default", ENTERPRISE_POLICY_PACKS[0]);
  }

  public activatePack(tenantId: string, packId: string, actorId: string): PolicyPack {
    const pack = ENTERPRISE_POLICY_PACKS.find((p) => p.id === packId);
    if (!pack) throw new Error(`Policy pack not found: ${packId}`);

    this.activePacks.set(tenantId, pack);

    auditLedger.record({
      runId: "sys_policy_pack",
      stepId: "step_pack_activate",
      eventType: "policy_pack.activated",
      tenantId,
      actorType: "security_admin",
      actorId,
      details: { packId, packVersion: pack.version, name: pack.name },
    });

    return pack;
  }

  public getActivePack(tenantId: string): PolicyPack {
    return this.activePacks.get(tenantId) || ENTERPRISE_POLICY_PACKS[0];
  }
}

export const policyPackManager = new PolicyPackManager();
