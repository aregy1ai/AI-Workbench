/**
 * AI Workbench - Policy Engine Service & Decision Store
 * Sprint 4: Policy Engine & Tool Gateway
 */

import { PolicyDecision, PolicyInput } from "../../contracts/src/policy";
import { evaluatePolicy } from "./rules";

export class PolicyRepository {
  private decisions = new Map<string, { toolCallId: string; decision: PolicyDecision; createdAt: Date }>();

  public save(toolCallId: string, decision: PolicyDecision): void {
    this.decisions.set(decision.decisionId, {
      toolCallId,
      decision,
      createdAt: new Date(),
    });
  }

  public getByToolCall(toolCallId: string): PolicyDecision | undefined {
    for (const record of this.decisions.values()) {
      if (record.toolCallId === toolCallId) {
        return record.decision;
      }
    }
    return undefined;
  }

  public clear(): void {
    this.decisions.clear();
  }
}

export class PolicyEngine {
  constructor(private readonly repository: PolicyRepository = new PolicyRepository()) {}

  public async evaluate(input: PolicyInput): Promise<PolicyDecision> {
    return evaluatePolicy(input);
  }

  public getRepository(): PolicyRepository {
    return this.repository;
  }
}

export const policyRepository = new PolicyRepository();
export const policyEngine = new PolicyEngine(policyRepository);
