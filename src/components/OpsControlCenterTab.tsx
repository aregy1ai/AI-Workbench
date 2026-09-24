/**
 * AI Workbench - مركز العمليات والحوادث المؤسسي (Ops & SRE Control Center)
 * مرجع التصميم: ai-workbench-ops & ai-workbench-ops-git
 * باللغة العربية بالكامل
 */

import React, { useState } from "react";
import { TenantInfo } from "../types";
import {
  opsEngine,
  IncidentRecord,
  IncidentState,
  IncidentSeverity,
  AlertDefinition,
  WriteFenceStatus,
  AccessReviewRecord,
  RetentionPolicyReport,
  FeatureFlag,
} from "../../packages/ops/src/ops-engine";
import {
  AlertOctagon,
  ShieldCheck,
  Radio,
  History,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Sliders,
  FileSpreadsheet,
  Layers,
  Database,
  UserCheck,
  Zap,
  Globe,
  Plus,
  Send,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Activity,
  Flame,
} from "lucide-react";

interface OpsControlCenterTabProps {
  currentTenant: TenantInfo;
}

type OpsSubSection =
  | "incidents"
  | "alerts"
  | "write_fence"
  | "access_review"
  | "retention"
  | "feature_flags"
  | "weekly_review";

export const OpsControlCenterTab: React.FC<OpsControlCenterTabProps> = ({
  currentTenant,
}) => {
  const [activeSubSection, setActiveSubSection] = useState<OpsSubSection>("incidents");
  const [incidents, setIncidents] = useState<IncidentRecord[]>(() => opsEngine.getIncidents());
  const [alerts] = useState<AlertDefinition[]>(() => opsEngine.getAlerts());
  const [writeFence, setWriteFence] = useState<WriteFenceStatus>(() => opsEngine.getWriteFence());
  const [accessReviews] = useState<AccessReviewRecord[]>(() => opsEngine.getAccessReviews());
  const [retentionReports, setRetentionReports] = useState<RetentionPolicyReport[]>(() =>
    opsEngine.getRetentionReports()
  );
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>(() =>
    opsEngine.getFeatureFlags()
  );

  // Selected Incident for Details / State Transition
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(
    incidents[0] || null
  );
  const [transitionNotes, setTransitionNotes] = useState("");
  const [targetState, setTargetState] = useState<IncidentState>("identified");

  // New Incident Form Modal/Panel
  const [showNewIncidentForm, setShowNewIncidentForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSeverity, setNewSeverity] = useState<IncidentSeverity>("P1");
  const [newService, setNewService] = useState("run-engine");

  const handleStateTransition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;

    try {
      const updated = opsEngine.transitionIncident(
        selectedIncident.id,
        targetState,
        "مهندس المناوبة (SRE On-Call)",
        transitionNotes || `تحديث الحالة إلى ${targetState}`
      );
      setIncidents(opsEngine.getIncidents());
      setSelectedIncident(updated);
      setTransitionNotes("");
    } catch (err: any) {
      console.error("Transition error:", err.message);
    }
  };

  const handleCreateIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const created = opsEngine.triggerManualIncident({
      title: newTitle,
      description: newDesc || "بلاغ طارئ بانتظار استكمال التفاصيل",
      severity: newSeverity,
      service: newService,
      tenantId: currentTenant.id,
    });

    setIncidents(opsEngine.getIncidents());
    setSelectedIncident(created);
    setShowNewIncidentForm(false);
    setNewTitle("");
    setNewDesc("");
  };

  const handlePurgeTable = (tableName: string) => {
    try {
      opsEngine.executeRetentionPurge(tableName);
      setRetentionReports(opsEngine.getRetentionReports());
    } catch (err: any) {
      console.error("Purge error:", err.message);
    }
  };

  const handleBumpFence = () => {
    const updated = opsEngine.bumpFencingToken();
    setWriteFence(updated);
  };

  const handleToggleFlag = (key: string) => {
    opsEngine.toggleFeatureFlag(key);
    setFeatureFlags(opsEngine.getFeatureFlags());
  };

  const getSeverityBadge = (sev: IncidentSeverity) => {
    switch (sev) {
      case "P0":
        return "bg-rose-950/80 text-rose-300 border-rose-500/40 ring-1 ring-rose-500/20";
      case "P1":
        return "bg-amber-950/80 text-amber-300 border-amber-500/40";
      case "P2":
        return "bg-cyan-950/80 text-cyan-300 border-cyan-500/40";
      case "P3":
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const getStateBadge = (state: IncidentState) => {
    switch (state) {
      case "investigating":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "identified":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "monitoring":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      case "resolved":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "postmortem":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
    }
  };

  const getStateArabicName = (state: IncidentState) => {
    switch (state) {
      case "investigating":
        return "قيد التحقيق والاستقصاء";
      case "identified":
        return "تم تحديد السبب الجذري";
      case "monitoring":
        return "قيد المراقبة والتأكد";
      case "resolved":
        return "تم الحل بنجاح";
      case "postmortem":
        return "تحليل ما بعد الحادث";
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* رأس الصفحة والمقدمة */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-reverse space-x-3 mb-2">
              <span className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <Flame className="w-6 h-6" />
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center space-x-reverse space-x-2">
                  <span>مركز العمليات والحوادث المؤسسي (Ops & SRE)</span>
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-rose-950/70 border border-rose-500/30 text-rose-300">
                    مرجع ai-workbench-ops
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  إدارة حوادث الإنتاج، دورة حياة البلاغات، سياج الحماية متعدد المناطق، تنبيهات بروميثيوس، ومراجعات الامتثال الأسبوعية.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowNewIncidentForm(true)}
              className="flex items-center space-x-reverse space-x-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل حادثة جديدة (Trigger Incident)</span>
            </button>
            <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-center space-x-reverse space-x-2">
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-slate-400">حالة المنظومة:</span>
              <span className="font-semibold text-emerald-400">تشغيل مستقر (99.98%)</span>
            </div>
          </div>
        </div>

        {/* المؤشرات السريعة (SRE Scorecard) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-slate-400 block mb-1">الحوادث النشطة (Active)</span>
            <div className="flex items-baseline space-x-reverse space-x-2">
              <span className="text-lg font-bold text-amber-400 font-mono">
                {incidents.filter((i) => i.state !== "resolved" && i.state !== "postmortem").length}
              </span>
              <span className="text-[11px] text-slate-500">حالات مفتوحة</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-slate-400 block mb-1">متوسط زمن الاستجابة (MTTD)</span>
            <div className="flex items-baseline space-x-reverse space-x-2">
              <span className="text-lg font-bold text-emerald-400 font-mono">3.4 دقيقة</span>
              <span className="text-[11px] text-emerald-500/80 flex items-center">
                <TrendingDown className="w-3 h-3 ml-0.5" /> -12%
              </span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-slate-400 block mb-1">متوسط زمن المعالجة (MTTR)</span>
            <div className="flex items-baseline space-x-reverse space-x-2">
              <span className="text-lg font-bold text-cyan-400 font-mono">18.2 دقيقة</span>
              <span className="text-[11px] text-slate-500">ضمن المعيار</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-slate-400 block mb-1">سياج المناطق (Fencing Token)</span>
            <div className="flex items-baseline space-x-reverse space-x-2">
              <span className="text-lg font-bold text-purple-400 font-mono">#{writeFence.fencingToken}</span>
              <span className="text-[11px] text-emerald-400">إجماع متطابق</span>
            </div>
          </div>
        </div>
      </div>

      {/* التبويبات الفرعية */}
      <div className="flex space-x-reverse space-x-2 overflow-x-auto pb-1 border-b border-slate-800">
        <button
          onClick={() => setActiveSubSection("incidents")}
          className={`flex items-center space-x-reverse space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubSection === "incidents"
              ? "bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          <span>إدارة الحوادث ودورة الحياة</span>
          <span className="px-1.5 py-0.2 bg-rose-950 border border-rose-500/30 text-rose-300 rounded-full text-[10px] font-mono">
            {incidents.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubSection("alerts")}
          className={`flex items-center space-x-reverse space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubSection === "alerts"
              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>سجل التنبيهات وكتيبات التشغيل</span>
        </button>

        <button
          onClick={() => setActiveSubSection("write_fence")}
          className={`flex items-center space-x-reverse space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubSection === "write_fence"
              ? "bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>سياج الكتابة متعدد المناطق</span>
        </button>

        <button
          onClick={() => setActiveSubSection("retention")}
          className={`flex items-center space-x-reverse space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubSection === "retention"
              ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>سياسات حفظ وتطهير البيانات</span>
        </button>

        <button
          onClick={() => setActiveSubSection("access_review")}
          className={`flex items-center space-x-reverse space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubSection === "access_review"
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>مراجعة الصلاحيات والامتثال</span>
        </button>

        <button
          onClick={() => setActiveSubSection("feature_flags")}
          className={`flex items-center space-x-reverse space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubSection === "feature_flags"
              ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>مفاتيح الميزات الموزعة</span>
        </button>

        <button
          onClick={() => setActiveSubSection("weekly_review")}
          className={`flex items-center space-x-reverse space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubSection === "weekly_review"
              ? "bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>المراجعة التشغيلية الأسبوعية</span>
        </button>
      </div>

      {/* محتوى التبويب الأول: الحوادث ودورة الحياة */}
      {activeSubSection === "incidents" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* قائمة الحوادث */}
          <div className="lg:col-span-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-300 flex items-center justify-between">
              <span>سجل الحوادث والإنذارات</span>
              <span className="text-xs text-slate-500 font-normal">
                {incidents.length} حوادث مسجلة
              </span>
            </h3>

            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedIncident?.id === inc.id
                      ? "bg-slate-900 border-rose-500/50 shadow-md shadow-rose-950/20 ring-1 ring-rose-500/30"
                      : "bg-slate-900/60 border-slate-800 hover:bg-slate-900/90 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${getSeverityBadge(
                        inc.severity
                      )}`}
                    >
                      {inc.severity}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border ${getStateBadge(
                        inc.state
                      )}`}
                    >
                      {getStateArabicName(inc.state)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 mr-auto">
                      {inc.id}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-slate-200 line-clamp-1 mb-1">
                    {inc.title}
                  </h4>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {inc.description}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                    <span>الخدمة: <strong className="text-slate-400 font-mono">{inc.service}</strong></span>
                    <span>{new Date(inc.createdAt).toLocaleTimeString("ar-EG")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* تفاصيل الحادثة المحددة ومسار الانتقال */}
          <div className="lg:col-span-7 space-y-4">
            {selectedIncident ? (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center space-x-reverse space-x-2 mb-1">
                      <span className="font-mono text-xs text-slate-400">{selectedIncident.id}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${getSeverityBadge(selectedIncident.severity)}`}>
                        {selectedIncident.severity}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getStateBadge(selectedIncident.state)}`}>
                        {getStateArabicName(selectedIncident.state)}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white leading-snug">
                      {selectedIncident.title}
                    </h3>
                  </div>
                </div>

                {/* الوصف وملخص الأثر */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/70">
                    <span className="text-slate-400 block mb-1 font-semibold">وصف الحادثة:</span>
                    <p className="text-slate-300 leading-relaxed">{selectedIncident.description}</p>
                  </div>
                  <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/70">
                    <span className="text-slate-400 block mb-1 font-semibold">ملخص الأثر والحدود:</span>
                    <p className="text-slate-300 leading-relaxed">{selectedIncident.impactSummary}</p>
                  </div>
                </div>

                {/* السبب الجذري وخطوات التخفيف إن وجدت */}
                {selectedIncident.rootCause && (
                  <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-4 text-xs space-y-2">
                    <span className="font-bold text-amber-300 flex items-center space-x-reverse space-x-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      <span>السبب الجذري المكتشف (Root Cause):</span>
                    </span>
                    <p className="text-slate-300">{selectedIncident.rootCause}</p>

                    {selectedIncident.mitigationSteps && (
                      <div className="mt-2 pt-2 border-t border-amber-500/20">
                        <span className="text-amber-200/90 font-medium block mb-1">خطوات المعالجة والتخفيف:</span>
                        <ul className="list-disc list-inside space-y-1 text-slate-300">
                          {selectedIncident.mitigationSteps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* الخط الزمني لانتقالات الحالة (Lifecycle Transitions) */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center space-x-reverse space-x-2">
                    <History className="w-4 h-4 text-cyan-400" />
                    <span>سجل وتاريخ الانتقالات (Incident State Transitions)</span>
                  </h4>
                  <div className="space-y-2">
                    {selectedIncident.transitions.map((trans, idx) => (
                      <div
                        key={idx}
                        className="flex items-start space-x-reverse space-x-3 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/60 text-xs"
                      >
                        <span className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-[11px] mb-0.5">
                            <span className="font-semibold text-slate-200">
                              انتقال إلى [{getStateArabicName(trans.toState)}] بواسطة {trans.actor}
                            </span>
                            <span className="text-slate-500 font-mono">
                              {new Date(trans.timestamp).toLocaleTimeString("ar-EG")}
                            </span>
                          </div>
                          <p className="text-slate-400">{trans.notes}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* نموذج ترقية ونقل حالة الحادثة (State Machine Transition Action) */}
                <form
                  onSubmit={handleStateTransition}
                  className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3"
                >
                  <h4 className="text-xs font-bold text-slate-200 flex items-center space-x-reverse space-x-2">
                    <ArrowRight className="w-4 h-4 text-rose-400" />
                    <span>ترقية مسار الحادثة (Advance Incident State)</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">الحالة المستهدفة:</label>
                      <select
                        value={targetState}
                        onChange={(e) => setTargetState(e.target.value as IncidentState)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                      >
                        <option value="investigating">قيد التحقيق (Investigating)</option>
                        <option value="identified">تم التحديد (Identified)</option>
                        <option value="monitoring">قيد المراقبة (Monitoring)</option>
                        <option value="resolved">تم الحل (Resolved)</option>
                        <option value="postmortem">تحليل ما بعد الحادث (Postmortem)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">ملاحظات المناوبة والمبرر:</label>
                      <input
                        type="text"
                        value={transitionNotes}
                        onChange={(e) => setTransitionNotes(e.target.value)}
                        placeholder="أدخل إجراءات التدخل أو نتائج التحقق..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 cursor-pointer"
                    >
                      تحديث الحالة وتسجيل الملاحظة
                    </button>
                  </div>
                </form>

                {/* تقرير ما بعد الحادث Postmortem إن وجد */}
                {selectedIncident.postmortem && (
                  <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-4 text-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-purple-500/20">
                      <span className="font-bold text-purple-300 flex items-center space-x-reverse space-x-1.5">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span>تقرير ما بعد الحادث المعتمد (Postmortem Report)</span>
                      </span>
                      <span className="font-mono text-[11px] text-purple-400">
                        {selectedIncident.postmortem.hashSignature}
                      </span>
                    </div>

                    <p className="text-slate-300 leading-relaxed">
                      {selectedIncident.postmortem.summary}
                    </p>

                    <div className="space-y-1.5 pt-1">
                      <span className="text-purple-200 font-semibold block">إجراءات المتابعة الوقائية (Action Items):</span>
                      {selectedIncident.postmortem.actionItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-950/60 p-2 rounded border border-purple-500/10">
                          <span className="text-slate-300">{item.task} (المسؤول: {item.owner})</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.status === "completed" ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-300"}`}>
                            {item.status === "completed" ? "مكتمل" : "قيد التنفيذ"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs">
                اختر حادثة من القائمة لاستعراض تفاصيلها ومسار دورة حياتها
              </div>
            )}
          </div>
        </div>
      )}

      {/* محتوى التبويب الثاني: سجل التنبيهات وRunbooks */}
      {activeSubSection === "alerts" && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200">سجل قواعد تنبيهات Prometheus ومطابقة كتيبات التشغيل</h3>
              <p className="text-xs text-slate-400">
                فحص آلي يضمن أن كل تنبيه إنتاج مرتبط بكتيب تشغيل معتمد (Runbook) ومحدد بالاستعلام الدقيق.
              </p>
            </div>
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-mono">
              100% Runbook Coverage
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map((al) => (
              <div key={al.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-reverse space-x-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${getSeverityBadge(al.severity)}`}>
                      {al.severity}
                    </span>
                    <span className="font-bold text-sm text-white">{al.name}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${al.status === "firing" ? "bg-rose-950 text-rose-300 border border-rose-500/30 animate-pulse" : "bg-slate-950 text-slate-400"}`}>
                    {al.status === "firing" ? "مفعل حالياً (Firing)" : "مستقر (Normal)"}
                  </span>
                </div>

                <p className="text-xs text-slate-400">{al.description}</p>

                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 font-mono text-[11px] text-cyan-300 break-all">
                  <span className="text-slate-500 block text-[10px] mb-0.5">تعبير الاستعلام (PromQL Expression):</span>
                  {al.expr}
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                  <span className="text-slate-500 text-[11px]">المدة المشروطة: {al.forDuration}</span>
                  <a
                    href={al.runbookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-reverse space-x-1 text-[11px]"
                  >
                    <span>عرض دليل التشغيل (Runbook)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* محتوى التبويب الثالث: سياج الكتابة متعدد المناطق */}
      {activeSubSection === "write_fence" && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-reverse space-x-2">
                  <Globe className="w-5 h-5 text-purple-400" />
                  <span>سياج الكتابة الموزع وحماية انقسام الشبكة (Multi-Region Write Fence)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  مرجع <code>apps/region/src/write-fence.ts</code> — يمنع الكتابة المزدوجة وتضارب السجلات بين المناطق عبر رمز السياج (Fencing Token).
                </p>
              </div>

              <button
                onClick={handleBumpFence}
                className="flex items-center space-x-reverse space-x-2 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تحديث رمز السياج (Bump Fencing Token)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-1">المنطقة الرئيسية النشطة للكتابة:</span>
                <span className="font-bold text-purple-300 font-mono text-sm block">
                  {writeFence.activeRegion}
                </span>
                <span className="text-[11px] text-emerald-400 mt-1 flex items-center space-x-reverse space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>تأكيد الإجماع النشط (Leader Quorum)</span>
                </span>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-1">رمز السياج الحالي (Monotonic Token):</span>
                <span className="font-bold text-cyan-300 font-mono text-xl block">
                  #{writeFence.fencingToken}
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  توليد متزايد يرفض أي كتابة ذات رمز قديم
                </span>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-1">حماية انقسام العقل (Split-Brain Guard):</span>
                <span className="font-bold text-emerald-400 font-mono text-sm block">
                  مفعلة بنسبة 100%
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  نبضات القلب: {new Date(writeFence.lastHeartbeat).toLocaleTimeString("ar-EG")}
                </span>
              </div>
            </div>

            {/* حالة النسخ الاحتياطية وتزامن المناطق */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300">مصفوفة النسخ والمناطق المتزامنة (Replication Quorum)</h4>
              <div className="space-y-2">
                {writeFence.quorumReplicas.map((rep, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                    <div className="flex items-center space-x-reverse space-x-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-semibold text-slate-200">{rep.region}</span>
                    </div>
                    <div className="flex items-center space-x-reverse space-x-4 text-slate-400 font-mono">
                      <span>زمن التأخير: <strong className="text-cyan-300">{rep.latencyMs} ms</strong></span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/20">
                        {rep.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* محتوى التبويب الرابع: سياسات حفظ وتطهير البيانات */}
      {activeSubSection === "retention" && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200">سياسات حفظ البيانات وتطهير السجلات الدورية (Retention Enforce)</h3>
              <p className="text-xs text-slate-400">
                مرجع <code>apps/ops/src/retention/enforce.ts</code> — الامتثال التلقائي لقوانين الخصوصية وتطهير البيانات التاريخية المنتهية.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {retentionReports.map((rep, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-200 font-mono">{rep.table}</span>
                  <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-950 text-emerald-300 border border-emerald-500/20">
                    متوافق (Compliant)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950 p-3 rounded-lg border border-slate-800/60">
                  <div>
                    <span className="text-slate-500 block">فترة الحفظ القصوى:</span>
                    <strong className="text-slate-300 font-mono">{rep.retentionDays} يوم</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">إجمالي السجلات المطهرة:</span>
                    <strong className="text-cyan-300 font-mono">{rep.purgedRowsCount.toLocaleString()} سجل</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                  <span className="text-slate-500 text-[11px]">
                    آخر فحص: {new Date(rep.lastPurgedAt).toLocaleDateString("ar-EG")}
                  </span>
                  <button
                    onClick={() => handlePurgeTable(rep.table)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-all cursor-pointer"
                  >
                    تطهير يدوي فوري
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* محتوى التبويب الخامس: مراجعة الصلاحيات والامتثال */}
      {activeSubSection === "access_review" && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200">المراجعات الدورية للوصول والصلاحيات (Canonical Access Review)</h3>
              <p className="text-xs text-slate-400">
                مرجع <code>apps/ops/src/access/canonical.ts</code> — فحص ربع سنوي للحسابات الإدارية وتوثيق سحب الصلاحيات غير المستخدمة.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {accessReviews.map((rev) => (
              <div key={rev.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-reverse space-x-2">
                      <span className="font-mono text-xs text-slate-400">{rev.id}</span>
                      <strong className="text-sm text-white">{rev.quarter}</strong>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{rev.scope}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded text-xs font-semibold ${rev.status === "certified" ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30" : "bg-amber-950 text-amber-300 border border-amber-500/30"}`}>
                    {rev.status === "certified" ? "معتمد وموثق بشهادة رقمية" : "قيد المراجعة والتدقيق"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-950 p-3 rounded-lg border border-slate-800/60 font-mono">
                  <div>
                    <span className="text-slate-500 block font-sans">المراجع المعتمد:</span>
                    <span className="text-slate-300">{rev.reviewer}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-sans">الحسابات المفحوصة:</span>
                    <span className="text-cyan-300">{rev.totalAccountsReviewed} حساب</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-sans">الحسابات الملغاة:</span>
                    <span className="text-rose-400">{rev.revokedAccountsCount} ملغى</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-sans">بصمة الاعتماد:</span>
                    <span className="text-purple-300">{rev.certificateHash || "بانتظار التوقيع"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* محتوى التبويب السادس: مفاتيح الميزات الموزعة */}
      {activeSubSection === "feature_flags" && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200">مفاتيح الميزات والتحكم بالتوزيع التدريجي (Feature Flags & Hash Rollout)</h3>
              <p className="text-xs text-slate-400">
                مرجع <code>apps/ops/src/flags/evaluate.ts</code> — إطلاق الميزات بنسب مئوية محسوبة عبر التجزئة التشفيرية (Hash Rollout) دون إعادة نشر.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {featureFlags.map((flag) => (
              <div key={flag.key} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-reverse space-x-2 mb-1">
                    <span className="font-mono text-sm font-bold text-cyan-300">{flag.key}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 border border-slate-800 text-slate-400">
                      نسبة النشر: {flag.rolloutPercentage}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{flag.description}</p>
                </div>

                <div className="flex items-center space-x-reverse space-x-3 shrink-0">
                  <button
                    onClick={() => handleToggleFlag(flag.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      flag.enabled
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-400"
                    }`}
                  >
                    {flag.enabled ? "مفعل (Enabled)" : "معطل (Disabled)"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* محتوى التبويب السابع: المراجعة التشغيلية الأسبوعية */}
      {activeSubSection === "weekly_review" && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-reverse space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                <span>المراجعة التشغيلية الأسبوعية لفرق العمليات (Weekly Ops Review)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                مرجع <code>apps/ops/src/reviews/weekly.ts</code> و <code>infra/k8s/cronjobs/weekly-review.yaml</code>
              </p>
            </div>
            <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold">
              الأسبوع 38 - 2026
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">إجمالي الحوادث هذا الأسبوع:</span>
              <span className="text-xl font-bold text-amber-400 font-mono">2 حوادث</span>
              <span className="text-[11px] text-emerald-400 block mt-1">تم حل 100% منها</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">الالتزام باتفاقية الخدمة (SLA):</span>
              <span className="text-xl font-bold text-emerald-400 font-mono">99.98%</span>
              <span className="text-[11px] text-slate-500 block mt-1">المستهدف: 99.95%</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">التدقيق المالي للميزانيات:</span>
              <span className="text-xl font-bold text-purple-400 font-mono">متطابق</span>
              <span className="text-[11px] text-purple-300 block mt-1">تصفية تلقائية للحسابات</span>
            </div>
          </div>

          {/* قائمة التحقق للمراجعة */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300">قائمة فحص المهام الأسبوعية (Operations Checklist)</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center space-x-reverse space-x-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300">مراجعة تقارير ما بعد الحوادث واعتماد الإجراءات الوقائية لـ P0 و P1.</span>
              </div>
              <div className="flex items-center space-x-reverse space-x-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300">التأكد من اكتمال تدوير مفاتيح التشفير التلقائية المنتهية.</span>
              </div>
              <div className="flex items-center space-x-reverse space-x-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300">التحقق من سلامة سياج الكتابة متعدد المناطق ومطابقة زمن التأخير.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تسجيل حادثة جديدة (Modal) */}
      {showNewIncidentForm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-reverse space-x-2">
                <AlertOctagon className="w-5 h-5 text-rose-500" />
                <span>تسجيل حادثة تشغيلية طارئة</span>
              </h3>
              <button
                onClick={() => setShowNewIncidentForm(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                إلغاء
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">عنوان الحادثة:</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: ارتفاع معدل أخطاء استدعاء أدوات التشفير..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">مستوى الخطورة (Severity):</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as IncidentSeverity)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value="P0">P0 - خطر كارثي وتوقف الخدمة</option>
                    <option value="P1">P1 - أثر مرتفع على الوكلاء</option>
                    <option value="P2">P2 - أثر متوسط ومقيد</option>
                    <option value="P3">P3 - تنبيه طفيف</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">الخدمة المتأثرة:</label>
                  <input
                    type="text"
                    value={newService}
                    onChange={(e) => setNewService(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">وصف تفصيلي للحالة:</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="أدخل الأعراض الملحوظة والسياق التشغيلي..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end space-x-reverse space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewIncidentForm(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/20 cursor-pointer"
                >
                  فتح البلاغ فوراً
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
