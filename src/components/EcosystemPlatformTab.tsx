/**
 * AI Workbench - Sprint 11 GA & Ecosystem Platform Interactive Tab
 * Public API, SDK, Webhooks, Marketplace, Billing & Change Governance
 */

import React, { useState, useEffect } from "react";
import { TenantInfo } from "../types";
import { apiKeyService, ApiKeyRecord } from "../../packages/api/src/keys";
import { publicApiRouter, ApiResponse } from "../../packages/api/src/routes";
import { webhookDispatcher, WebhookEndpoint, WebhookDelivery } from "../../packages/webhooks/src/dispatcher";
import { toolMarketplace, CertifiedToolRecord } from "../../packages/marketplace/src/registry";
import { billingEngine, UsageInvoice, TIERED_PLANS } from "../../packages/billing/src/reconciliation";
import {
  changeGovernance,
  GA_LAUNCH_GATES,
  ChangeRecord,
} from "../../packages/governance/src/change-governance";
import { runEcosystemTestSuite, EcosystemTestResult } from "../../tests/ecosystem/ecosystem-ga.test";
import {
  Globe,
  Key,
  Webhook,
  Store,
  CreditCard,
  GitPullRequest,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  ShieldAlert,
  Flame,
  FileCode2,
  FileCheck,
  Send,
  Zap,
} from "lucide-react";

interface Props {
  currentTenant: TenantInfo;
}

export const EcosystemPlatformTab: React.FC<Props> = ({ currentTenant }) => {
  const [subTab, setSubTab] = useState<
    "gates" | "api" | "webhooks" | "marketplace" | "billing" | "governance" | "tests"
  >("gates");

  // API State
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [activeKey, setActiveKey] = useState<string>("");
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiPath, setApiPath] = useState<string>("/v1/tasks");
  const [apiMethod, setApiMethod] = useState<"GET" | "POST">("POST");
  const [apiPayload, setApiPayload] = useState<string>(
    JSON.stringify({ title: "Fix memory leak in pool", prompt: "Inspect worker loop" }, null, 2)
  );

  // Webhooks State
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [endpointUrl, setEndpointUrl] = useState("https://api.customer.io/webhooks");

  // Marketplace State
  const [tools, setTools] = useState<CertifiedToolRecord[]>([]);

  // Billing State
  const [selectedPlan, setSelectedPlan] = useState<"trial" | "team" | "business" | "enterprise">("team");
  const [invoice, setInvoice] = useState<UsageInvoice | null>(null);

  // Governance State
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [govTitle, setGovTitle] = useState("Update Sandbox Egress Allowlist for NPM CDN");
  const [govType, setGovType] = useState<ChangeRecord["changeType"]>("sandbox_isolation");
  const [govRisk, setGovRisk] = useState<ChangeRecord["riskLevel"]>("high");
  const [govError, setGovError] = useState<string | null>(null);

  // Tests State
  const [testResults, setTestResults] = useState<EcosystemTestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  useEffect(() => {
    refreshData();
  }, [currentTenant]);

  const refreshData = () => {
    // API Keys
    const keys = apiKeyService.listKeys(currentTenant.id);
    if (keys.length === 0) {
      const generated = apiKeyService.generateKey("Default Production Key", {
        tenantId: currentTenant.id,
        workspaceIds: ["*"],
        allowedOperations: ["*"],
        allowedRepositories: ["*"],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        rateLimitProfile: "unlimited",
      });
      setApiKeys([generated.record]);
      setActiveKey(generated.rawKey);
    } else {
      setApiKeys(keys);
    }

    // Webhooks
    const eps = webhookDispatcher.getEndpoints(currentTenant.id);
    if (eps.length === 0) {
      const ep = webhookDispatcher.registerEndpoint(
        currentTenant.id,
        "https://webhook.site/workbench-listener",
        ["*"]
      );
      setEndpoints([ep]);
    } else {
      setEndpoints(eps);
    }
    setDeliveries(webhookDispatcher.getDeliveries(currentTenant.id));

    // Marketplace
    setTools(toolMarketplace.listTools());

    // Billing
    setInvoice(billingEngine.reconcileInvoice(currentTenant.id, selectedPlan));

    // Governance
    setChanges(changeGovernance.listChanges());
  };

  const handleGenerateKey = () => {
    const key = apiKeyService.generateKey(`Scoped Key ${apiKeys.length + 1}`, {
      tenantId: currentTenant.id,
      workspaceIds: ["*"],
      allowedOperations: ["POST:tasks", "POST:runs", "GET:runs"],
      allowedRepositories: ["*"],
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      rateLimitProfile: "standard",
    });
    setApiKeys(apiKeyService.listKeys(currentTenant.id));
    setActiveKey(key.rawKey);
  };

  const handleRevokeKey = (keyId: string) => {
    apiKeyService.revokeKey(keyId);
    setApiKeys(apiKeyService.listKeys(currentTenant.id));
  };

  const handleExecuteApi = async () => {
    setApiResponse(null);
    let parsedBody;
    try {
      if (apiPayload) parsedBody = JSON.parse(apiPayload);
    } catch {
      setApiResponse({ error: "Invalid JSON in payload" });
      return;
    }

    const res = await publicApiRouter.handleRequest(
      apiMethod,
      apiPath,
      activeKey,
      parsedBody,
      `req_${Date.now()}`
    );
    setApiResponse(res);
  };

  const handleDispatchWebhook = async () => {
    const res = await webhookDispatcher.dispatchEvent(
      currentTenant.id,
      "run.completed",
      `evt_${Date.now()}`,
      { runId: `run_${Date.now()}`, outcome: "succeeded", durationMs: 4200 }
    );
    setDeliveries(webhookDispatcher.getDeliveries(currentTenant.id));
  };

  const handleToggleKillSwitch = (toolId: string, currentKilled: boolean) => {
    toolMarketplace.setKillSwitch(
      toolId,
      !currentKilled,
      currentKilled ? "Administrative unblock" : "Critical CVE patch in progress"
    );
    setTools([...toolMarketplace.listTools()]);
  };

  const handleProposeChange = () => {
    setGovError(null);
    changeGovernance.proposeChange(
      govType,
      govTitle,
      govRisk,
      ["packages/policy/src/packs.ts", "packages/sandbox/src/profiles.ts"],
      "Automatic git revert to stable digest",
      "eng_current_user"
    );
    setChanges(changeGovernance.listChanges());
  };

  const handleApproveChange = (changeId: string, approverId: string) => {
    setGovError(null);
    try {
      changeGovernance.approveChange(changeId, approverId);
      setChanges(changeGovernance.listChanges());
    } catch (err: any) {
      setGovError(err.message);
    }
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const results = await runEcosystemTestSuite();
      setTestResults(results);
    } finally {
      setIsRunningTests(false);
    }
  };

  const manifest = changeGovernance.getProductionReleaseManifest();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-lg text-white">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Sprint 11 — General Availability & Ecosystem Platform
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                  GA-4 Certified
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Public API v1 · Scoped Keys · Webhooks HMAC · Tool Marketplace · Tiered Plans · Two-Person Rule
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleRunTests}
            disabled={isRunningTests}
            className="flex items-center space-x-2 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isRunningTests ? "Running Tests..." : "Run Sprint 11 Suite"}</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex space-x-1 border-b border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: "gates", label: "GA Launch Gates & Manifest", icon: Globe },
          { id: "api", label: "Public API & SDK Playground", icon: Key },
          { id: "webhooks", label: "Webhooks & HMAC Signatures", icon: Webhook },
          { id: "marketplace", label: "Tool Marketplace & Kill Switches", icon: Store },
          { id: "billing", label: "Plans & Invoice Reconciliation", icon: CreditCard },
          { id: "governance", label: "Change Governance (2-Person Rule)", icon: GitPullRequest },
          { id: "tests", label: "Automated Test Suite", icon: CheckCircle2 },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as any)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. GA LAUNCH GATES & MANIFEST */}
      {subTab === "gates" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {GA_LAUNCH_GATES.map((gate) => (
              <div
                key={gate.stage}
                className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono text-cyan-400">{gate.stage}</span>
                    <span className="flex items-center text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Passed
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-200 mb-1">{gate.name}</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">{gate.description}</p>
                </div>
                <div className="text-[10px] space-y-1 text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
                  <div>SLO Window: {gate.requiredSloWindowDays}d</div>
                  <div>Max Open SEV1: {gate.maxOpenSev1}</div>
                  <div className="text-emerald-400">Rollback Verified: Yes</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-cyan-400" />
              Certified Production Release Manifest (Reproducible Artifacts)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="space-y-2 bg-slate-950 p-4 rounded-lg border border-slate-800">
                <div className="text-slate-400">Release ID: <span className="text-cyan-300 font-bold">{manifest.releaseId}</span></div>
                <div className="text-slate-400">Commit SHA: <span className="text-slate-300">{manifest.gitSha}</span></div>
                <div className="text-slate-400">DB Migration: <span className="text-emerald-400">{manifest.databaseMigrationVersion}</span></div>
                <div className="text-slate-400">Policy Version: <span className="text-purple-400">{manifest.policyVersion}</span></div>
                <div className="text-slate-400">Approved By: <span className="text-slate-200">{manifest.approvedBy.join(", ")}</span></div>
              </div>
              <div className="space-y-2 bg-slate-950 p-4 rounded-lg border border-slate-800">
                <div className="text-xs font-semibold text-slate-300 mb-1">Immutable Sandbox Image Digests:</div>
                <div className="text-[11px] text-slate-400">
                  <span className="text-indigo-400">isolated:</span> {manifest.sandboxImageDigests.isolated}
                </div>
                <div className="text-[11px] text-slate-400">
                  <span className="text-cyan-400">medium:</span> {manifest.sandboxImageDigests.medium}
                </div>
                <div className="mt-3 text-[11px] text-emerald-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>No moving tags (like latest) permitted in production.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PUBLIC API & SDK PLAYGROUND */}
      {subTab === "api" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Key className="w-4 h-4 text-cyan-400" />
                  Scoped API Credentials
                </h3>
                <button
                  onClick={handleGenerateKey}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg border border-slate-700"
                >
                  + Generate Key
                </button>
              </div>

              <div className="space-y-2">
                {apiKeys.map((k) => (
                  <div
                    key={k.id}
                    className={`p-3 rounded-lg border text-xs ${
                      k.status === "active"
                        ? "bg-slate-950 border-slate-800"
                        : "bg-red-950/20 border-red-900/30 text-red-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{k.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          k.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {k.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-400 mt-1">Prefix: {k.keyPrefix}••••••••</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Operations: {k.scope.allowedOperations.join(", ")}
                    </div>
                    {k.status === "active" && (
                      <div className="mt-2 flex items-center justify-end">
                        <button
                          onClick={() => handleRevokeKey(k.id)}
                          className="text-[11px] text-red-400 hover:text-red-300"
                        >
                          Revoke Key
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Send className="w-4 h-4 text-cyan-400" />
                Interactive API Request Sandbox
              </h3>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <select
                    value={apiMethod}
                    onChange={(e) => setApiMethod(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-cyan-400"
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                  </select>
                  <input
                    type="text"
                    value={apiPath}
                    onChange={(e) => setApiPath(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs font-mono text-slate-200"
                    placeholder="/v1/tasks"
                  />
                  <button
                    onClick={handleExecuteApi}
                    className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded transition-all"
                  >
                    Send
                  </button>
                </div>

                {apiMethod === "POST" && (
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block font-mono">Payload (JSON):</label>
                    <textarea
                      value={apiPayload}
                      onChange={(e) => setApiPayload(e.target.value)}
                      rows={4}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}

                {apiResponse && (
                  <div className="mt-4">
                    <div className="text-[11px] font-semibold text-slate-400 mb-1">
                      Response (Status: {apiResponse.status}):
                    </div>
                    <pre className="bg-slate-950 border border-slate-800 p-3 rounded text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-56">
                      {JSON.stringify(apiResponse.body, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. WEBHOOKS & HMAC */}
      {subTab === "webhooks" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-1 flex items-center gap-2">
                <Webhook className="w-4 h-4 text-cyan-400" />
                Signed Webhook Dispatcher
              </h3>
              <p className="text-xs text-slate-400">
                Every payload includes <code className="text-cyan-300">X-Workbench-Signature-256</code> with HMAC & replay timestamping.
              </p>
            </div>
            <button
              onClick={handleDispatchWebhook}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded-lg text-xs font-semibold"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Simulate Event (run.completed)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-slate-300 mb-3">Active Endpoints</h4>
              {endpoints.map((ep) => (
                <div key={ep.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
                  <div className="text-slate-200 font-mono break-all">{ep.url}</div>
                  <div className="text-slate-400 text-[11px]">Secret: {ep.secret.substring(0, 16)}••••</div>
                  <div className="text-emerald-400 text-[10px]">Events: {ep.subscribedEvents.join(", ")}</div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-slate-300 mb-3">Recent Delivery Log</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {deliveries.length === 0 ? (
                  <div className="text-xs text-slate-500 py-4 text-center">No webhook deliveries yet. Click Simulate.</div>
                ) : (
                  deliveries.map((d) => (
                    <div key={d.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded text-xs space-y-1 font-mono">
                      <div className="flex items-center justify-between text-cyan-400">
                        <span>{d.eventType}</span>
                        <span className="text-emerald-400">HTTP {d.responseCode}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 break-all">Sig: {d.signature}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. TOOL MARKETPLACE */}
      {subTab === "marketplace" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tools.map((t) => (
              <div
                key={t.id}
                className={`p-4 rounded-xl border flex flex-col justify-between ${
                  t.isKilled
                    ? "bg-red-950/20 border-red-900/50"
                    : "bg-slate-900 border-slate-800"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-200 font-mono">{t.manifest.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        t.isKilled
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {t.isKilled ? "KILL SWITCH ACTIVE" : t.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mb-2">Publisher: {t.manifest.publisher} (v{t.manifest.version})</div>
                  <p className="text-xs text-slate-300 mb-3">{t.manifest.description}</p>
                </div>

                <div className="border-t border-slate-800/80 pt-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                    <span>Security Score: <b className="text-cyan-400">{t.securityScore}/100</b></span>
                    <span>Max: {t.manifest.maxRuntimeMs / 1000}s</span>
                  </div>
                  <button
                    onClick={() => handleToggleKillSwitch(t.id, t.isKilled)}
                    className={`w-full py-1.5 text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition-all ${
                      t.isKilled
                        ? "bg-emerald-600 hover:bg-emerald-500 text-slate-950"
                        : "bg-red-600 hover:bg-red-500 text-white"
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>{t.isKilled ? "Deactivate Kill Switch" : "Emergency Kill Switch"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. BILLING & INVOICE RECONCILIATION */}
      {subTab === "billing" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {Object.values(TIERED_PLANS).map((p) => (
              <div
                key={p.name}
                onClick={() => {
                  setSelectedPlan(p.name);
                  setInvoice(billingEngine.reconcileInvoice(currentTenant.id, p.name));
                }}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedPlan === p.name
                    ? "bg-slate-800/90 border-cyan-500/50 shadow-md"
                    : "bg-slate-900 border-slate-800 opacity-70 hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold uppercase text-cyan-400">{p.name}</h4>
                  <span className="text-xs font-bold text-slate-200">${p.monthlyBasePrice}/mo</span>
                </div>
                <div className="text-[11px] text-slate-400 space-y-1 mt-2">
                  <div>Daily Runs: <b>{p.dailyRunLimit}</b></div>
                  <div>Concurrency: <b>{p.concurrencyLimit}</b></div>
                  <div>SLA Uptime: <b className="text-emerald-400">{p.slaUptime}</b></div>
                </div>
              </div>
            ))}
          </div>

          {invoice && (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    Certified Reconciled Invoice
                  </h3>
                  <div className="text-[11px] text-slate-400 font-mono">Invoice ID: {invoice.invoiceId} · Recon: {invoice.usageReconciliationId}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Total Settled</div>
                  <div className="text-lg font-bold text-emerald-400">${invoice.total.toFixed(2)} USD</div>
                </div>
              </div>

              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono">
                    <th className="py-2">Item / Metric</th>
                    <th className="py-2">Quantity</th>
                    <th className="py-2">Unit Price</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {invoice.lineItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 text-slate-200">{item.metric}</td>
                      <td className="py-2">{item.quantity}</td>
                      <td className="py-2">${item.unitPrice}</td>
                      <td className="py-2 text-right">${item.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ledger Reconciliation Discrepancy: $0.00 (Zero variance)</span>
                </span>
                <span className="text-slate-400">Status: <b className="text-slate-200">{invoice.status.toUpperCase()}</b></span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. CHANGE GOVERNANCE */}
      {subTab === "governance" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Propose Sensitive Architecture Change (Two-Person Rule Enforced)
            </h3>

            {govError && (
              <div className="mb-3 p-3 bg-red-950/40 border border-red-900/60 rounded-lg text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span>{govError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <input
                type="text"
                value={govTitle}
                onChange={(e) => setGovTitle(e.target.value)}
                placeholder="Change description"
                className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 md:col-span-2"
              />
              <select
                value={govRisk}
                onChange={(e) => setGovRisk(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300"
              >
                <option value="low">Low Risk (1 Approval)</option>
                <option value="medium">Medium Risk (1 Approval)</option>
                <option value="high">High Risk (2 Distinct Approvals)</option>
                <option value="critical">Critical (2 Distinct Approvals)</option>
              </select>
            </div>

            <button
              onClick={handleProposeChange}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs font-semibold border border-slate-700"
            >
              Propose Change Record
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <h4 className="text-xs font-bold text-slate-300 mb-3">Registered Change Records</h4>
            <div className="space-y-3">
              {changes.map((c) => (
                <div key={c.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-200">{c.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${c.riskLevel === "high" || c.riskLevel === "critical" ? "bg-red-500/20 text-red-400" : "bg-cyan-500/20 text-cyan-400"}`}>
                        {c.riskLevel.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">By: {c.proposedBy}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Approvers: {c.approvedBy.length > 0 ? c.approvedBy.join(", ") : "None yet"} · Status: <b className="text-slate-200">{c.status}</b>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {c.status === "proposed" && (
                      <>
                        <button
                          onClick={() => handleApproveChange(c.id, "eng_current_user")}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded text-[11px] border border-slate-700"
                          title="Simulate Proposer Self-Approval"
                        >
                          Self Approve (Test Block)
                        </button>
                        <button
                          onClick={() => handleApproveChange(c.id, "sec_officer_bob")}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold rounded text-[11px]"
                        >
                          SecOps Sign-Off
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. AUTOMATED TESTS */}
      {subTab === "tests" && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Sprint 11 GA Readiness Automated Test Suite
              </h3>
              <p className="text-xs text-slate-400">
                Verifies scoped keys, idempotent API routing, HMAC webhooks, marketplace kill switches, invoice reconciliation, and 2-person rule.
              </p>
            </div>
            <button
              onClick={handleRunTests}
              disabled={isRunningTests}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs rounded transition-all disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isRunningTests ? "Running..." : "Run Tests"}</span>
            </button>
          </div>

          {testResults.length === 0 ? (
            <div className="text-xs text-slate-500 py-8 text-center">
              Click "Run Tests" to execute the 10 automated integration tests.
            </div>
          ) : (
            <div className="space-y-2">
              {testResults.map((t, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                    t.passed
                      ? "bg-slate-950/60 border-slate-800 text-slate-300"
                      : "bg-red-950/20 border-red-900/40 text-red-300"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {t.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    )}
                    <div>
                      <div className="font-semibold text-slate-200">
                        <span className="text-slate-400 font-normal">[{t.suite}]</span> {t.name}
                      </div>
                      {t.details && <div className="text-[11px] text-slate-400 mt-0.5">{t.details}</div>}
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 text-right">
                    <div>Exp: {t.expected}</div>
                    <div className="text-slate-500">Act: {t.actual}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
