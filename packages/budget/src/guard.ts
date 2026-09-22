/**
 * AI Workbench - Budget Governance & Reserve-Settle Guardrails
 * Phase: Sprint 3 & 4 Budget Management
 */

import { Run } from "../../contracts/src/run";
import { failure, Result, success } from "../../contracts/src/errors";

export interface BudgetLedgerItem {
  id: string;
  runId: string;
  type: "reserve" | "settle" | "refund";
  amount: number;
  remainingLimit: number;
  timestamp: string;
  description: string;
}

export class BudgetGuard {
  private history: BudgetLedgerItem[] = [];

  public getLedger(runId?: string): BudgetLedgerItem[] {
    if (runId) {
      return this.history.filter((h) => h.runId === runId);
    }
    return [...this.history];
  }

  /**
   * Atomically reserves budget prior to external execution or LLM call
   */
  public reserve(run: Run, estimatedCost: number, description: string): Result<Run> {
    const totalCommitted = run.budgetConsumed + run.budgetReserved + estimatedCost;
    if (totalCommitted > run.budgetLimit) {
      return failure(
        "BUDGET_EXCEEDED",
        `Budget limit breached: Requested reserve $${estimatedCost.toFixed(4)}, but total ($${totalCommitted.toFixed(4)}) exceeds limit $${run.budgetLimit.toFixed(4)}`
      );
    }

    const updated: Run = {
      ...run,
      budgetReserved: run.budgetReserved + estimatedCost,
    };

    this.history.push({
      id: `bg_${Math.random().toString(36).substring(2, 8)}`,
      runId: run.id,
      type: "reserve",
      amount: estimatedCost,
      remainingLimit: run.budgetLimit - (updated.budgetConsumed + updated.budgetReserved),
      timestamp: new Date().toISOString(),
      description,
    });

    return success(updated);
  }

  /**
   * Settles actual cost consumed and releases unused reserved balance
   */
  public settle(run: Run, reservedCost: number, actualCost: number, description: string): Run {
    const newReserved = Math.max(0, run.budgetReserved - reservedCost);
    const newConsumed = run.budgetConsumed + actualCost;

    const updated: Run = {
      ...run,
      budgetReserved: newReserved,
      budgetConsumed: newConsumed,
    };

    this.history.push({
      id: `bg_${Math.random().toString(36).substring(2, 8)}`,
      runId: run.id,
      type: "settle",
      amount: actualCost,
      remainingLimit: run.budgetLimit - (updated.budgetConsumed + updated.budgetReserved),
      timestamp: new Date().toISOString(),
      description: `${description} (Settled $${actualCost.toFixed(4)}, Released $${(reservedCost - actualCost).toFixed(4)})`,
    });

    return updated;
  }

  /**
   * Releases reserved amount without settling any cost (e.g. on execution failure or cancellation)
   */
  public release(run: Run, reservedCost: number, description?: string): Run {
    const newReserved = Math.max(0, run.budgetReserved - reservedCost);

    const updated: Run = {
      ...run,
      budgetReserved: newReserved,
    };

    this.history.push({
      id: `bg_${Math.random().toString(36).substring(2, 8)}`,
      runId: run.id,
      type: "refund",
      amount: reservedCost,
      remainingLimit: run.budgetLimit - (updated.budgetConsumed + updated.budgetReserved),
      timestamp: new Date().toISOString(),
      description: description || `Released reserved budget of $${reservedCost.toFixed(4)}`,
    });

    return updated;
  }
}

export const budgetGuard = new BudgetGuard();
