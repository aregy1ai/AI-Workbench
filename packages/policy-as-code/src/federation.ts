/**
 * AI Workbench - Enterprise Federation & Organization Policy Inheritance
 * Sprint 14: Enterprise Intelligence & Policy-as-Code
 */

import { auditLedger } from "../../audit/src/ledger";

export interface PolicyContext {
  globalVersion: string;
  organizationVersion: string;
  tenantVersion: string;
  workspaceVersion?: string;
  runOverrideVersion?: string;
}

export interface HierarchyDecisionResult {
  effectiveDecision: "allow" | "deny" | "require_approval";
  resolvedAtLevel: "global" | "organization" | "tenant" | "workspace" | "default";
  blockedByHigherLevel: boolean;
  reason: string;
  inheritanceChain: PolicyContext;
}

export class EnterpriseFederationEngine {
  /**
   * Resolves cascading policies down the enterprise hierarchy
   * Hard Rule: Lower policies CANNOT relax a higher level's 'deny'
   */
  public evaluateHierarchy(
    action: string,
    context: {
      globalRules: { tool: string; decision: "allow" | "deny" | "require_approval" }[];
      orgRules: { tool: string; decision: "allow" | "deny" | "require_approval" }[];
      tenantRules: { tool: string; decision: "allow" | "deny" | "require_approval" }[];
      workspaceRules?: { tool: string; decision: "allow" | "deny" | "require_approval" }[];
    }
  ): HierarchyDecisionResult {
    const inheritanceChain: PolicyContext = {
      globalVersion: "global-v1.4",
      organizationVersion: "org-v3.1",
      tenantVersion: "tenant-v2.0",
      workspaceVersion: context.workspaceRules ? "ws-v1.0" : undefined,
    };

    // 1. Global Level Evaluation
    const globalMatch = context.globalRules.find((r) => r.tool === action || r.tool === "*");
    if (globalMatch?.decision === "deny") {
      return {
        effectiveDecision: "deny",
        resolvedAtLevel: "global",
        blockedByHigherLevel: true,
        reason: `GLOBAL_DENY_ENFORCED: Action '${action}' is unconditionally denied at the Enterprise Global Policy level`,
        inheritanceChain,
      };
    }

    // 2. Organization Level Evaluation
    const orgMatch = context.orgRules.find((r) => r.tool === action || r.tool === "*");
    if (orgMatch?.decision === "deny") {
      return {
        effectiveDecision: "deny",
        resolvedAtLevel: "organization",
        blockedByHigherLevel: true,
        reason: `ORG_DENY_ENFORCED: Action '${action}' is denied by Organization Business Unit policy`,
        inheritanceChain,
      };
    }

    // 3. Tenant Level Evaluation
    const tenantMatch = context.tenantRules.find((r) => r.tool === action || r.tool === "*");
    if (tenantMatch?.decision === "deny") {
      return {
        effectiveDecision: "deny",
        resolvedAtLevel: "tenant",
        blockedByHigherLevel: true,
        reason: `TENANT_DENY_ENFORCED: Action '${action}' is denied by Tenant policy`,
        inheritanceChain,
      };
    }

    // 4. Workspace Level Evaluation
    if (context.workspaceRules) {
      const wsMatch = context.workspaceRules.find((r) => r.tool === action || r.tool === "*");
      if (wsMatch?.decision === "deny") {
        return {
          effectiveDecision: "deny",
          resolvedAtLevel: "workspace",
          blockedByHigherLevel: false,
          reason: `WORKSPACE_DENY_ENFORCED: Action '${action}' is denied by Workspace policy`,
          inheritanceChain,
        };
      }
      if (wsMatch?.decision === "require_approval") {
        return {
          effectiveDecision: "require_approval",
          resolvedAtLevel: "workspace",
          blockedByHigherLevel: false,
          reason: `WORKSPACE_APPROVAL_MANDATED: Workspace policy requires approval for '${action}'`,
          inheritanceChain,
        };
      }
      if (wsMatch?.decision === "allow") {
        return {
          effectiveDecision: "allow",
          resolvedAtLevel: "workspace",
          blockedByHigherLevel: false,
          reason: `WORKSPACE_PERMITTED: Workspace explicitly allows '${action}'`,
          inheritanceChain,
        };
      }
    }

    // Fallback to tenant/org/global decision or default deny
    const effective = tenantMatch?.decision || orgMatch?.decision || globalMatch?.decision || "deny";
    const resolvedLevel = tenantMatch ? "tenant" : orgMatch ? "organization" : globalMatch ? "global" : "default";

    return {
      effectiveDecision: effective,
      resolvedAtLevel: resolvedLevel,
      blockedByHigherLevel: false,
      reason: `INHERITANCE_RESOLVED: Action '${action}' evaluated to '${effective}' at ${resolvedLevel} tier`,
      inheritanceChain,
    };
  }
}

export const enterpriseFederationEngine = new EnterpriseFederationEngine();
