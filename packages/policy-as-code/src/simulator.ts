/**
 * AI Workbench - Enterprise Policy Diff & Pre-Flight Simulator
 * Sprint 14: Enterprise Intelligence & Policy-as-Code
 */

import { RiskLevel } from "../../policy/src/risk-adaptive";
import { PolicyBundle } from "./compiler";
import { policyDecisionExplainer } from "./explainer";
import { auditLedger } from "../../audit/src/ledger";

export interface PolicyDiff {
  action: string;
  resource: string;
  currentDecision: string;
  candidateDecision: string;
  risk: RiskLevel;
  affectedTenants: string[];
  sampleEvidenceIds: string[];
}

export interface PreFlightSimulationSummary {
  simulationId: string;
  currentVersion: string;
  candidateVersion: string;
  totalEvaluations: number;
  newlyAllowed: number;
  newlyDenied: number;
  highRiskDifferences: number;
  requiresIndependentSignOff: boolean;
  canDeploySafely: boolean;
  diffs: PolicyDiff[];
  simulatedAt: string;
}

export class EnterprisePolicySimulator {
  private benchmarkActions = [
    { action: "github.create_pull_request", resource: "repo:frontend-core", tenantId: "tenant_fintech_01", approvalsProvided: 0 },
    { action: "github.merge_pull_request", resource: "repo:frontend-core:main", tenantId: "tenant_fintech_01", approvalsProvided: 1 },
    { action: "vault.read_secret", resource: "vault:db_credentials", tenantId: "tenant_health_02", approvalsProvided: 0 },
    { action: "sandbox.execute_command", resource: "container:bash", tenantId: "tenant_fintech_01", approvalsProvided: 0 },
    { action: "database.drop_table", resource: "postgres:users", tenantId: "tenant_fintech_01", approvalsProvided: 2 },
    { action: "network.open_egress", resource: "net:0.0.0.0/0", tenantId: "tenant_health_02", approvalsProvided: 0 },
    { action: "audit.purge_records", resource: "ledger:merkle_chain", tenantId: "tenant_fintech_01", approvalsProvided: 3 },
  ];

  /**
   * Compares current vs candidate policy bundles across standard enterprise scenarios
   */
  public runSimulation(
    currentBundle: PolicyBundle,
    candidateBundle: PolicyBundle
  ): PreFlightSimulationSummary {
    const diffs: PolicyDiff[] = [];
    let newlyAllowed = 0;
    let newlyDenied = 0;
    let highRiskDifferences = 0;

    for (const item of this.benchmarkActions) {
      const currentDec = policyDecisionExplainer.explainDecision(currentBundle, {
        action: item.action,
        tenantId: item.tenantId,
        approvalsProvided: item.approvalsProvided,
      });

      const candidateDec = policyDecisionExplainer.explainDecision(candidateBundle, {
        action: item.action,
        tenantId: item.tenantId,
        approvalsProvided: item.approvalsProvided,
      });

      if (currentDec.result !== candidateDec.result) {
        if (candidateDec.result === "allow" && currentDec.result !== "allow") {
          newlyAllowed++;
          if (candidateDec.riskLevel === "critical" || candidateDec.riskLevel === "high") {
            highRiskDifferences++;
          }
        } else if (candidateDec.result === "deny" && currentDec.result === "allow") {
          newlyDenied++;
        }

        diffs.push({
          action: item.action,
          resource: item.resource,
          currentDecision: currentDec.result,
          candidateDecision: candidateDec.result,
          risk: candidateDec.riskLevel,
          affectedTenants: [item.tenantId],
          sampleEvidenceIds: [`ev_${Math.random().toString(36).substring(2, 8)}`],
        });
      }
    }

    const requiresIndependentSignOff = highRiskDifferences > 0;
    const canDeploySafely = !requiresIndependentSignOff;

    const summary: PreFlightSimulationSummary = {
      simulationId: `sim_ent_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      currentVersion: currentBundle.version,
      candidateVersion: candidateBundle.version,
      totalEvaluations: this.benchmarkActions.length,
      newlyAllowed,
      newlyDenied,
      highRiskDifferences,
      requiresIndependentSignOff,
      canDeploySafely,
      diffs,
      simulatedAt: new Date().toISOString(),
    };

    auditLedger.record({
      tenantId: "system_policy",
      eventType: "ENTERPRISE_POLICY_SIMULATION_COMPLETED",
      actorId: "enterprise_policy_simulator",
      actorType: "system",
      details: {
        simulationId: summary.simulationId,
        canDeploySafely,
        highRiskDifferences,
        newlyAllowed,
        newlyDenied,
      },
    });

    return summary;
  }
}

export const enterprisePolicySimulator = new EnterprisePolicySimulator();
