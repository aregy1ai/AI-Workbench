/**
 * AI Workbench - Policy Simulator & Historical Replay Engine
 * Sprint 13: Platform Intelligence & Autonomous Operations
 */

import { auditLedger } from "../../audit/src/ledger";
import { RiskPolicyRule } from "./risk-adaptive";

export interface HistoricalPolicyDecision {
  id: string;
  action: string;
  tenantId: string;
  actorRoles: string[];
  historicalOutcome: "allow" | "deny" | "approval_required";
  riskLevel: "low" | "medium" | "high" | "critical";
  timestamp: string;
}

export interface PolicySimulation {
  simulationId: string;
  candidatePolicyVersion: string;
  sampleSize: number;
  newlyAllowed: number;
  newlyDenied: number;
  highRiskDifferences: number;
  affectedTenants: string[];
  falsePositiveEstimate: number;
  falseNegativeEstimate: number;
  passedSafetyCheck: boolean;
  blockReasons: string[];
  simulatedAt: string;
}

export class PolicySimulator {
  private historicalLog: HistoricalPolicyDecision[] = [];

  constructor() {
    this.seedHistoricalLog();
  }

  private seedHistoricalLog() {
    this.historicalLog = [
      {
        id: "hist_01",
        action: "read:src/index.ts",
        tenantId: "tenant_fintech_01",
        actorRoles: ["developer"],
        historicalOutcome: "allow",
        riskLevel: "low",
        timestamp: new Date(Date.now() - 86400_000 * 2).toISOString(),
      },
      {
        id: "hist_02",
        action: "patch:apply",
        tenantId: "tenant_fintech_01",
        actorRoles: ["developer"],
        historicalOutcome: "allow",
        riskLevel: "medium",
        timestamp: new Date(Date.now() - 86400_000 * 2).toISOString(),
      },
      {
        id: "hist_03",
        action: "github:merge_main",
        tenantId: "tenant_fintech_01",
        actorRoles: ["developer"],
        historicalOutcome: "approval_required",
        riskLevel: "critical",
        timestamp: new Date(Date.now() - 86400_000).toISOString(),
      },
      {
        id: "hist_04",
        action: "vault:access_restricted",
        tenantId: "tenant_health_02",
        actorRoles: ["operator"],
        historicalOutcome: "approval_required",
        riskLevel: "high",
        timestamp: new Date(Date.now() - 86400_000).toISOString(),
      },
      {
        id: "hist_05",
        action: "network:raw_egress",
        tenantId: "tenant_health_02",
        actorRoles: ["developer"],
        historicalOutcome: "deny",
        riskLevel: "critical",
        timestamp: new Date(Date.now() - 3600_000 * 12).toISOString(),
      },
      {
        id: "hist_06",
        action: "linter:run",
        tenantId: "tenant_fintech_01",
        actorRoles: ["developer"],
        historicalOutcome: "allow",
        riskLevel: "low",
        timestamp: new Date(Date.now() - 3600_000 * 6).toISOString(),
      },
      {
        id: "hist_07",
        action: "database:drop_or_truncate",
        tenantId: "tenant_fintech_01",
        actorRoles: ["admin"],
        historicalOutcome: "approval_required",
        riskLevel: "critical",
        timestamp: new Date(Date.now() - 3600_000 * 2).toISOString(),
      },
    ];
  }

  /**
   * Replays historical decisions against a candidate set of rules
   */
  public simulatePolicyCandidate(
    candidateVersion: string,
    candidateRules: RiskPolicyRule[]
  ): PolicySimulation {
    let newlyAllowed = 0;
    let newlyDenied = 0;
    let highRiskDifferences = 0;
    const affectedTenantsSet = new Set<string>();
    const blockReasons: string[] = [];

    for (const record of this.historicalLog) {
      // Evaluate rule match in candidate
      const rule = candidateRules.find((r) => {
        if (r.actionPattern === record.action) return true;
        if (r.actionPattern.endsWith("*")) {
          const prefix = r.actionPattern.slice(0, -1);
          return record.action.startsWith(prefix);
        }
        return false;
      });

      let candidateOutcome: "allow" | "deny" | "approval_required" = "deny";
      if (rule) {
        if (rule.requiredApprovals > 0) {
          candidateOutcome = "approval_required";
        } else {
          candidateOutcome = "allow";
        }
      }

      if (candidateOutcome !== record.historicalOutcome) {
        affectedTenantsSet.add(record.tenantId);

        if (candidateOutcome === "allow" && record.historicalOutcome !== "allow") {
          newlyAllowed++;
          if (record.riskLevel === "critical" || record.riskLevel === "high") {
            highRiskDifferences++;
            blockReasons.push(
              `UNGUARDED_HIGH_RISK: Candidate policy relaxes '${record.action}' (${record.riskLevel}) from ${record.historicalOutcome} to unapproved 'allow'`
            );
          }
        } else if (candidateOutcome === "deny" && record.historicalOutcome === "allow") {
          newlyDenied++;
        }
      }
    }

    // Safety checks
    if (highRiskDifferences > 0) {
      blockReasons.push(
        `SAFETY_INVARIANT_BREACH: ${highRiskDifferences} high-risk differences detected without mandatory approval controls`
      );
    }

    const passedSafetyCheck = blockReasons.length === 0;

    const simulation: PolicySimulation = {
      simulationId: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      candidatePolicyVersion: candidateVersion,
      sampleSize: this.historicalLog.length,
      newlyAllowed,
      newlyDenied,
      highRiskDifferences,
      affectedTenants: Array.from(affectedTenantsSet),
      falsePositiveEstimate: Number((newlyDenied / this.historicalLog.length).toFixed(3)),
      falseNegativeEstimate: Number((newlyAllowed / this.historicalLog.length).toFixed(3)),
      passedSafetyCheck,
      blockReasons,
      simulatedAt: new Date().toISOString(),
    };

    auditLedger.record({
      tenantId: "system_policy",
      eventType: "POLICY_SIMULATION_COMPLETED",
      actorId: "policy_simulator",
      actorType: "system",
      details: {
        candidateVersion,
        passed: passedSafetyCheck,
        highRiskDifferences,
        newlyAllowed,
        newlyDenied,
      },
    });

    return simulation;
  }

  public getHistoricalCount(): number {
    return this.historicalLog.length;
  }
}

export const policySimulator = new PolicySimulator();
