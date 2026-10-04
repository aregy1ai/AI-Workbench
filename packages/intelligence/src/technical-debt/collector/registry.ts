import { Evidence } from "../contracts/evidence";
import {
  normalizeActionlintJson,
  normalizeOsvSarif,
  normalizeSarif,
  normalizeTrivySarif,
} from "./normalizer";
import {
  normalizeDependencyCruiserJson,
  normalizeGitleaksJson,
  normalizeKnipJson,
  normalizeScorecardJson,
  normalizeSyftJson,
} from "./specialized-normalizers";
import { ToolOutputEnvelope } from "./types";

export interface TdiToolAdapter {
  readonly toolId: string;
  normalize(envelope: ToolOutputEnvelope): Evidence[];
}

const adapters = new Map<string, TdiToolAdapter>([
  ["codeql", { toolId: "codeql", normalize: (e) => normalizeSarif(e, "security") }],
  ["semgrep", { toolId: "semgrep", normalize: (e) => normalizeSarif(e, "static_analysis") }],
  ["osv-scanner", { toolId: "osv-scanner", normalize: normalizeOsvSarif }],
  ["trivy", { toolId: "trivy", normalize: normalizeTrivySarif }],
  ["actionlint", { toolId: "actionlint", normalize: normalizeActionlintJson }],
  ["dependency-cruiser", {
    toolId: "dependency-cruiser",
    normalize: normalizeDependencyCruiserJson,
  }],
  ["knip", { toolId: "knip", normalize: normalizeKnipJson }],
  ["scorecard", { toolId: "scorecard", normalize: normalizeScorecardJson }],
  ["syft", { toolId: "syft", normalize: normalizeSyftJson }],
  ["gitleaks", { toolId: "gitleaks", normalize: normalizeGitleaksJson }],
]);

export function registerTdiToolAdapter(adapter: TdiToolAdapter): void {
  if (!adapter.toolId.trim()) throw new Error("TDI_ADAPTER_ID_REQUIRED");
  if (adapters.has(adapter.toolId)) {
    throw new Error("TDI_ADAPTER_ALREADY_REGISTERED:" + adapter.toolId);
  }
  adapters.set(adapter.toolId, adapter);
}

export function getTdiToolAdapter(toolId: string): TdiToolAdapter {
  const adapter = adapters.get(toolId);
  if (!adapter) throw new Error("TDI_ADAPTER_NOT_REGISTERED:" + toolId);
  return adapter;
}

export function normalizeToolOutput(envelope: ToolOutputEnvelope): Evidence[] {
  return getTdiToolAdapter(envelope.invocation.toolId).normalize(envelope);
}
