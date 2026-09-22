import React from "react";
import { TenantInfo } from "../types";
import {
  ShieldCheck,
  Cpu,
  Layers,
  FileCheck2,
  KeyRound,
  DollarSign,
  Building2,
  ChevronDown,
} from "lucide-react";

interface HeaderProps {
  currentTenant: TenantInfo;
  tenants: TenantInfo[];
  onSelectTenant: (tenant: TenantInfo) => void;
  activeLeasesCount: number;
  budgetConsumed: number;
  budgetReserved: number;
  budgetLimit: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTenant,
  tenants,
  onSelectTenant,
  activeLeasesCount,
  budgetConsumed,
  budgetReserved,
  budgetLimit,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  AI Workbench
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
                  Control Plane
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Autonomous Agent Lifecycle, Sandboxed Execution & Hash-Chained Audit
              </p>
            </div>
          </div>

          {/* Architectural Planes Status */}
          <div className="hidden lg:flex items-center space-x-2 bg-slate-950/60 border border-slate-800/80 rounded-lg p-1.5 text-[11px]">
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Control</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span>Intelligence</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            </div>
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Execution</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            </div>
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
              <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Evidence</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            </div>
          </div>

          {/* Tenant Selector & Guard Indicators */}
          <div className="flex items-center space-x-3">
            {/* Secret Broker Leases */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                activeLeasesCount > 0
                  ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
                  : "bg-slate-950 border-slate-800 text-slate-400"
              }`}
              title="Active Secret Broker leases (short-lived credentials; zero permanent secrets)"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Leases: {activeLeasesCount}</span>
            </div>

            {/* Budget Guardrail Indicator */}
            <div
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-950 border border-slate-800 text-slate-300"
              title={`Budget Limit: $${budgetLimit.toFixed(2)} | Consumed: $${budgetConsumed.toFixed(4)} | Reserved: $${budgetReserved.toFixed(4)}`}
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                ${budgetConsumed.toFixed(3)}
                <span className="text-slate-500 font-normal"> / ${budgetLimit.toFixed(0)}</span>
              </span>
            </div>

            {/* Multi-Tenant Switcher */}
            <div className="relative group">
              <button className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-colors">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="max-w-[120px] truncate">{currentTenant.name}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              <div className="absolute right-0 mt-1 w-56 bg-slate-900 border border-slate-800 rounded-lg shadow-xl shadow-black/50 py-1 hidden group-hover:block z-50">
                <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-slate-500 border-b border-slate-800">
                  Select Tenant Context (RLS Boundary)
                </div>
                {tenants.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onSelectTenant(t)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800/60 ${
                      t.id === currentTenant.id ? "text-cyan-400 font-medium bg-slate-800/40" : "text-slate-300"
                    }`}
                  >
                    <span className="truncate">{t.name}</span>
                    <span className="text-[10px] text-slate-500">{t.plan}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
