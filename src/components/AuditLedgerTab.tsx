import React, { useState } from "react";
import { auditLedger, AuditEventRecord } from "../../packages/audit/src/hash-chain";
import { budgetGuard, BudgetLedgerItem } from "../../packages/budget/src/guard";
import { TenantInfo } from "../types";
import {
  FileCheck2,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Hash,
  Clock,
  DollarSign,
  Lock,
  Layers,
  Search,
} from "lucide-react";

interface AuditLedgerTabProps {
  currentTenant: TenantInfo;
  onRefreshMetrics: () => void;
}

export const AuditLedgerTab: React.FC<AuditLedgerTabProps> = ({
  currentTenant,
  onRefreshMetrics,
}) => {
  const [filterType, setFilterType] = useState<string>("all");
  const [verificationResult, setVerificationResult] = useState<{
    intact: boolean;
    corruptedIndex?: number;
    message: string;
  } | null>(null);

  const events = auditLedger.getEvents();
  const budgetItems = budgetGuard.getLedger();

  const handleVerify = () => {
    const res = auditLedger.verifyIntegrity();
    setVerificationResult(res);
  };

  const handleSimulateTamper = () => {
    if (events.length > 0) {
      auditLedger.tamperWithEvent(0, "[MALICIOUS INJECTION] Fake authorized patch without human approval");
      const res = auditLedger.verifyIntegrity();
      setVerificationResult(res);
      onRefreshMetrics();
    }
  };

  const handleResetTamper = () => {
    if (events.length > 0) {
      // Re-append legitimate state
      auditLedger.tamperWithEvent(0, "Executed tool in sandbox successfully. Ephemeral secret lease revoked.");
      const res = auditLedger.verifyIntegrity();
      setVerificationResult(res);
      onRefreshMetrics();
    }
  };

  const filteredEvents =
    filterType === "all" ? events : events.filter((e) => e.eventType.includes(filterType));

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                Evidence Plane
              </span>
              <span className="text-xs text-slate-400">Append-Only · SHA-256 Hash-Chained</span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Tamper-Evident Audit Ledger & Cost Governance
            </h2>
            <p className="text-xs text-slate-400 max-w-3xl">
              Unlike telemetry traces which can be sampled or discarded, the Audit Log is an immutable, append-only security record. Every state change, policy decision, approval, and secret lease issue is cryptographically chained using SHA-256.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleVerify}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow flex items-center space-x-1.5 transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Verify Cryptographic Chain</span>
            </button>
            <button
              onClick={handleSimulateTamper}
              className="px-3 py-2 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-medium text-xs flex items-center space-x-1.5 transition-all"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Simulate Tampering</span>
            </button>
            <button
              onClick={handleResetTamper}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Verification Alert Banner */}
        {verificationResult && (
          <div
            className={`mt-4 p-3.5 rounded-lg border text-xs flex items-center justify-between ${
              verificationResult.intact
                ? "bg-emerald-950/50 border-emerald-600 text-emerald-300"
                : "bg-rose-950/60 border-rose-600 text-rose-300 animate-pulse"
            }`}
          >
            <div className="flex items-center space-x-2">
              {verificationResult.intact ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="font-semibold">{verificationResult.message}</span>
            </div>
            <span className="font-mono text-[10px] text-slate-400">
              Verified at {new Date().toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Audit Events Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Hash className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Cryptographic Audit Chain ({filteredEvents.length} Events)
            </h3>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400">Filter:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300 text-xs focus:outline-none"
            >
              <option value="all">All Events</option>
              <option value="tool.call">Tool Calls</option>
              <option value="policy.decision">Policy Decisions</option>
              <option value="approval">Human Approvals</option>
              <option value="run.cancelled">Cancellations</option>
            </select>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-xs">
            No audit records registered yet. Execute actions in the Run Simulator or Tool Gateway to generate tamper-evident records.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-mono">
                <tr>
                  <th className="px-4 py-3">Seq #</th>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Payload Summary</th>
                  <th className="px-4 py-3">Previous Hash Link</th>
                  <th className="px-4 py-3">Event Hash</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {filteredEvents.map((evt) => (
                  <tr key={evt.eventId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-cyan-400">#{evt.sequenceNumber}</td>
                    <td className="px-4 py-3 font-semibold text-white">
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                        {evt.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{evt.actorId}</td>
                    <td className="px-4 py-3 text-slate-300 font-sans max-w-xs truncate" title={evt.payloadSummary}>
                      {evt.payloadSummary}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[10px] truncate max-w-[120px]" title={evt.previousEventHash}>
                      {evt.previousEventHash.substring(0, 16)}...
                    </td>
                    <td className="px-4 py-3 text-emerald-400 text-[10px] truncate max-w-[120px]" title={evt.eventHash}>
                      {evt.eventHash.substring(0, 16)}...
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[10px] font-sans">
                      {new Date(evt.occurredAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Budget Ledger & Burn-Down Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center space-x-2">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Budget Governance & Atomic Settle Ledger
          </h3>
        </div>

        {budgetItems.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs">
            No budget reserves or settlements yet.
          </div>
        ) : (
          <div className="space-y-2">
            {budgetItems.map((item) => (
              <div
                key={item.id}
                className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded font-mono ${
                        item.type === "reserve"
                          ? "bg-amber-950 text-amber-300 border border-amber-800"
                          : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                      }`}
                    >
                      {item.type}
                    </span>
                    <span className="text-slate-300">{item.description}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Remaining Allowed Limit: ${item.remainingLimit.toFixed(4)}
                  </div>
                </div>

                <div className="text-right font-mono font-bold text-slate-200">
                  {item.type === "reserve" ? `+$${item.amount.toFixed(4)}` : `$${item.amount.toFixed(4)}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
