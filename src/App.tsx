import React, { useState } from "react";
import { Header } from "./components/Header";
import { RunEngineTab } from "./components/RunEngineTab";
import { RunSimulatorTab } from "./components/RunSimulatorTab";
import { ToolGatewayTab } from "./components/ToolGatewayTab";
import { AuditLedgerTab } from "./components/AuditLedgerTab";
import { SecurityTestsTab } from "./components/SecurityTestsTab";
import { SandboxSchedulerTab } from "./components/SandboxSchedulerTab";
import { EcosystemPlatformTab } from "./components/EcosystemPlatformTab";
import { ContinuousImprovementTab } from "./components/ContinuousImprovementTab";
import { AutonomousOperationsTab } from "./components/AutonomousOperationsTab";
import { EnterprisePolicyTab } from "./components/EnterprisePolicyTab";
import { OpsControlCenterTab } from "./components/OpsControlCenterTab";
import { CodeExplorerTab } from "./components/CodeExplorerTab";
import { SAMPLE_TENANTS } from "./data/mockData";
import { TenantInfo } from "./types";
import { secretBroker } from "../packages/sandbox/src/scheduler";
import { budgetGuard } from "../packages/budget/src/guard";
import {
  Activity,
  Layers,
  FileCheck2,
  ShieldCheck,
  FolderTree,
  Cpu,
  Box,
  Globe,
  TrendingUp,
  Bot,
  Code2,
  Flame,
} from "lucide-react";

export default function App() {
  const [tenants] = useState<TenantInfo[]>(SAMPLE_TENANTS);
  const [currentTenant, setCurrentTenant] = useState<TenantInfo>(SAMPLE_TENANTS[0]);
  const [activeTab, setActiveTab] = useState<
    | "ops_center"
    | "enterprise_policy"
    | "engine"
    | "simulator"
    | "tools"
    | "sandbox"
    | "ecosystem"
    | "continuous_improvement"
    | "autonomous_operations"
    | "audit"
    | "security"
    | "code"
  >("ops_center");

  // Metrics trigger for header updates
  const [metricsRevision, setMetricsRevision] = useState(0);
  const refreshMetrics = () => setMetricsRevision((prev) => prev + 1);

  const activeLeases = secretBroker.getActiveLeases();
  const allLedger = budgetGuard.getLedger();
  const totalConsumed = allLedger
    .filter((l) => l.type === "settle")
    .reduce((acc, curr) => acc + curr.amount, 0);
  const totalReserved = allLedger
    .filter((l) => l.type === "reserve")
    .reduce((acc, curr) => acc + curr.amount, 0) - totalConsumed;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200" dir="rtl">
      {/* Top Header */}
      <Header
        currentTenant={currentTenant}
        tenants={tenants}
        onSelectTenant={(t) => {
          setCurrentTenant(t);
          refreshMetrics();
        }}
        activeLeasesCount={activeLeases.length}
        budgetConsumed={Math.max(0, totalConsumed)}
        budgetReserved={Math.max(0, totalReserved)}
        budgetLimit={currentTenant.budgetLimit}
      />

      {/* Main Tab Navigation */}
      <nav className="bg-slate-900/80 border-b border-slate-800 backdrop-blur sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-reverse space-x-1 sm:space-x-2 overflow-x-auto py-2">
            <button
              onClick={() => setActiveTab("ops_center")}
              className={`flex items-center space-x-reverse space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "ops_center"
                  ? "bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Flame className="w-4 h-4 text-rose-400" />
              <span>مركز العمليات والحوادث (Ops Center)</span>
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            </button>

            <button
              onClick={() => setActiveTab("enterprise_policy")}
              className={`flex items-center space-x-reverse space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "enterprise_policy"
                  ? "bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>السياسات البرمجية والحوكمة (Sprint 14)</span>
            </button>

            <button
              onClick={() => setActiveTab("engine")}
              className={`flex items-center space-x-reverse space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "engine"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>محرك تشغيل الوكلاء (Run Engine)</span>
            </button>

            <button
              onClick={() => setActiveTab("simulator")}
              className={`flex items-center space-x-reverse space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "simulator"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>المتحكم والمحاكي التفاعلي</span>
            </button>

            <button
              onClick={() => setActiveTab("tools")}
              className={`flex items-center space-x-reverse space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "tools"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>بوابة الأدوات ومصفوفة السياسات</span>
            </button>

            <button
              onClick={() => setActiveTab("sandbox")}
              className={`flex items-center space-x-reverse space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "sandbox"
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Box className="w-4 h-4" />
              <span>مجدول العزل والبيئات المعزولة</span>
            </button>

            <button
              onClick={() => setActiveTab("ecosystem")}
              className={`flex items-center space-x-reverse space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "ecosystem"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>منصة التوسع والمنظومة العامة</span>
            </button>

            <button
              onClick={() => setActiveTab("continuous_improvement")}
              className={`flex items-center space-x-reverse space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "continuous_improvement"
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>التحسين المستمر والتقييم الذاتي</span>
            </button>

            <button
              onClick={() => setActiveTab("autonomous_operations")}
              className={`flex items-center space-x-reverse space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "autonomous_operations"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>العمليات والتشخيص الذاتي</span>
            </button>

            <button
              onClick={() => setActiveTab("audit")}
              className={`flex items-center space-x-reverse space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "audit"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              <span>سلسلة الأدلة وسجل التدقيق التشفيري</span>
            </button>

            <button
              onClick={() => setActiveTab("security")}
              className={`flex items-center space-x-reverse space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "security"
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>اختبارات الأمان ومحرك RLS</span>
            </button>

            <button
              onClick={() => setActiveTab("code")}
              className={`flex items-center space-x-reverse space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "code"
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <FolderTree className="w-4 h-4" />
              <span>مستكشف الكود وهندسة المشروع</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "ops_center" && (
          <OpsControlCenterTab currentTenant={currentTenant} />
        )}

        {activeTab === "enterprise_policy" && (
          <EnterprisePolicyTab currentTenant={currentTenant} />
        )}

        {activeTab === "engine" && (
          <RunEngineTab
            currentTenant={currentTenant}
            onRefreshMetrics={refreshMetrics}
          />
        )}

        {activeTab === "simulator" && (
          <RunSimulatorTab
            currentTenant={currentTenant}
            onRefreshMetrics={refreshMetrics}
          />
        )}

        {activeTab === "tools" && (
          <ToolGatewayTab
            currentTenant={currentTenant}
            onRefreshMetrics={refreshMetrics}
          />
        )}

        {activeTab === "sandbox" && (
          <SandboxSchedulerTab
            currentTenant={currentTenant}
          />
        )}

        {activeTab === "ecosystem" && (
          <EcosystemPlatformTab
            currentTenant={currentTenant}
          />
        )}

        {activeTab === "continuous_improvement" && (
          <ContinuousImprovementTab
            currentTenant={currentTenant}
          />
        )}

        {activeTab === "autonomous_operations" && (
          <AutonomousOperationsTab
            currentTenant={currentTenant}
          />
        )}

        {activeTab === "audit" && (
          <AuditLedgerTab
            currentTenant={currentTenant}
            onRefreshMetrics={refreshMetrics}
          />
        )}

        {activeTab === "security" && (
          <SecurityTestsTab
            currentTenant={currentTenant}
            tenants={tenants}
          />
        )}

        {activeTab === "code" && <CodeExplorerTab />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-reverse space-x-2">
            <span className="font-bold text-slate-400">معمارية منصة ذكاء وحوكمة الوكلاء (AI Workbench)</span>
            <span>·</span>
            <span>التحكم · الذكاء · التنفيذ · الأدلة المشفرة</span>
          </div>
          <div className="flex items-center space-x-reverse space-x-3 text-[11px] font-mono">
            <span className="text-emerald-500 flex items-center space-x-reverse space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>عزل RLS مفعل بين المستأجرين</span>
            </span>
            <span className="text-cyan-500">·</span>
            <span>سلسلة التدقيق التشفيرية SHA-256 نشطة</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

