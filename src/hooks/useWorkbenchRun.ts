/**
 * AI Workbench - useWorkbenchRun Hook
 * React hook integrating @llm-workbench/adapters-react with real-time state extraction
 */

import { useMemo } from "react";
import { type WorkbenchRuntime, type SchemaRegistry } from "@llm-workbench/runtime";
import { useWorkbenchRunRevision } from "@llm-workbench/adapters-react";

export function useWorkbenchRun(
  runtime: WorkbenchRuntime,
  runId: string | null,
  registry?: SchemaRegistry
) {
  // Subscribe to state change notifications from the runtime
  const revision = useWorkbenchRunRevision(runtime, runId);

  const state = useMemo(() => {
    if (!runId) return null;
    return runtime.getState(runId) ?? null;
  }, [runtime, runId, revision]);

  const session = useMemo(() => {
    if (!runId) return null;
    try {
      return runtime.session(runId);
    } catch {
      return null;
    }
  }, [runtime, runId]);

  const artifacts = useMemo(() => {
    if (!state) return [];
    return Array.from(state.artifactsByKey.entries()).map(([key, ver]) => ({
      key,
      typeId: ver.typeId,
      version: ver.version,
      data: ver.data,
      createdAt: ver.createdAt,
    }));
  }, [state]);

  const ruleSets = useMemo(() => {
    if (!state) return [];
    return Array.from(state.ruleSetsById.entries()).map(([id, set]) => ({
      id,
      title: (set as any).title || set.ruleSchemaId,
      rules: set.rules,
    }));
  }, [state]);

  const gates = useMemo(() => {
    if (!state) return [];
    return Array.from(state.gateState.entries()).map(([stepId, gate]) => ({
      stepId,
      before: gate.before,
      after: gate.after,
      checkpoints: gate.checkpoints,
    }));
  }, [state]);

  const traces = useMemo(() => {
    if (!state) return [];
    return state.trace ?? [];
  }, [state]);

  return {
    revision,
    state,
    session,
    registry,
    artifacts,
    ruleSets,
    gates,
    traces,
    status: state?.run?.status ?? "unknown",
    workflow: state?.run?.workflowSnapshot,
  };
}
