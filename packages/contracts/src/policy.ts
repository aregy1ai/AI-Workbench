/**
 * AI Workbench - Policy Decision & Evaluation Contracts
 * Sprint 4: Policy Engine & Tool Gateway
 */

import { ToolDefinition } from "./tool";
import { ExecutionContextPayload } from "./execution-context";
import { RunStatus } from "./run";

export type PolicyDecision =
  | {
      decision: "allow";
      decisionId: string;
      policyVersion: string;
      reasonCode: string;
      expiresAt: Date;
    }
  | {
      decision: "deny";
      decisionId: string;
      policyVersion: string;
      reasonCode: string;
      expiresAt: Date;
    }
  | {
      decision: "approval_required";
      decisionId: string;
      policyVersion: string;
      reasonCode: string;
      approvalType: string;
      expiresAt: Date;
    };

export interface PolicyInput {
  context: ExecutionContextPayload;
  tool: ToolDefinition;
  input: unknown;
  actorRoles: string[];
  runStatus: RunStatus;
  remainingBudget: number;
}
