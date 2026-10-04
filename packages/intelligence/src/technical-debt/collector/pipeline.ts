import { randomUUID } from "node:crypto";
import { Evidence } from "../contracts/evidence";
import { CiEvidenceCollector } from "./ci";
import { GitHistoryEvidenceCollector } from "./git";
import { RepositoryEvidenceCollector } from "./repository";
import { TestEvidenceCollector, TdiTestEvidenceInput } from "./tests";
import { TdiScanOrchestrator, TdiScanRequest, TdiScanResult } from "./orchestrator";
import { PinnedSource } from "./types";
import { GitHistoryProvider } from "../source/github-history";
import { RepositoryFileReader } from "./repository";
import { digestJson } from "./digest";

export interface TdiEvidencePipelineInput {
  source: PinnedSource;
  repositoryCollector: RepositoryEvidenceCollector;
  historyProvider: GitHistoryProvider;
  toolScan?: TdiScanRequest;
  tools?: TdiScanOrchestrator;
  testInput?: TdiTestEvidenceInput;
  collectorVersion?: string;
}

export interface TdiEvidenceBundle {
  scan: {
    id: string;
    tenantId: string;
    workspaceId: string;
    repositoryId: string;
    commitSha: string;
    status: "completed" | "failed";
    collectorVersion: string;
    startedAt: string;
    completedAt: string;
  };
  evidence: readonly Evidence[];
  evidenceBundleDigest: string;
  toolScan?: TdiScanResult;
}

function compareEvidence(a: Evidence, b: Evidence): number {
  return a.id.localeCompare(b.id);
}

export class TdiEvidencePipeline {
  constructor(private readonly sourceReader: RepositoryFileReader) {}

  async collect(input: TdiEvidencePipelineInput): Promise<TdiEvidenceBundle> {
    const startedAt = new Date().toISOString();
    const scanId = randomUUID();

    const repositoryEvidence = await input.repositoryCollector.collect(input.source);
    const historyCollector = new GitHistoryEvidenceCollector(input.historyProvider);
    const gitEvidence = await historyCollector.collect(input.source);
    const ciCollector = new CiEvidenceCollector(input.historyProvider);
    const ciEvidence = await ciCollector.collect(input.source);

    let testEvidence: Evidence[] = [];
    if (input.testInput) {
      testEvidence = new TestEvidenceCollector().collect(input.testInput);
    }

    let toolScan: TdiScanResult | undefined;
    let toolEvidence: Evidence[] = [];
    if (input.tools && input.toolScan) {
      toolScan = await input.tools.scan(input.toolScan);
      toolEvidence = [...toolScan.evidence];
    }

    const evidence = [
      ...repositoryEvidence,
      ...gitEvidence,
      ...ciEvidence,
      ...testEvidence,
      ...toolEvidence,
    ].sort(compareEvidence);

    const evidenceBundleDigest = digestJson(
      evidence.map((item) => ({
        id: item.id,
        type: item.type,
        tenantId: item.tenantId,
        workspaceId: item.workspaceId,
        repositoryId: item.repositoryId,
        commitSha: item.commitSha,
        source: item.source,
        path: item.path ?? null,
        lineStart: item.lineStart ?? null,
        lineEnd: item.lineEnd ?? null,
        contentDigest: item.contentDigest,
        data: item.data,
      })),
    );

    return {
      scan: {
        id: scanId,
        tenantId: input.source.tenantId,
        workspaceId: input.source.workspaceId,
        repositoryId: input.source.repositoryId,
        commitSha: input.source.commitSha,
        status: "completed",
        collectorVersion: input.collectorVersion ?? "tdi-collector-v1",
        startedAt,
        completedAt: new Date().toISOString(),
      },
      evidence,
      evidenceBundleDigest,
      toolScan,
    };
  }
}
