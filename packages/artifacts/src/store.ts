/**
 * AI Workbench - Artifact Store & Collection Engine
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

import crypto from "crypto";
import { ArtifactType } from "./manifest";
import { artifactRules } from "./limits";
import { SandboxHandle } from "../../sandbox/src/cleanup";
import { runtime, SandboxRuntime } from "../../sandbox/src/runtime";
import { redact } from "../../audit/src/redaction";

export interface ArtifactRecord {
  id: string;
  tenantId?: string;
  workspaceId?: string;
  runId: string;
  stepId?: string;
  artifactType: ArtifactType;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  sensitivity: "internal" | "confidential";
  createdAt: string;
}

export class ObjectStore {
  private objects: Map<string, string | Buffer> = new Map();

  public async put(objectKey: string, content: string | Buffer): Promise<void> {
    this.objects.set(objectKey, content);
  }

  public async get(objectKey: string): Promise<string | Buffer | undefined> {
    return this.objects.get(objectKey);
  }

  public async putDirectory(
    _dirPath: string,
    options: { prefix: string }
  ): Promise<string> {
    const key = `${options.prefix}${Date.now()}.tar.zst`;
    this.objects.set(key, Buffer.from("snapshot_archive"));
    return key;
  }

  public clear(): void {
    this.objects.clear();
  }
}

export const objectStore = new ObjectStore();

export class ArtifactRepository {
  private records: Map<string, ArtifactRecord> = new Map();

  public async create(record: Omit<ArtifactRecord, "id" | "createdAt">): Promise<ArtifactRecord> {
    const id = `art_${Math.random().toString(36).substring(2, 10)}`;
    const fullRecord: ArtifactRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
    };
    this.records.set(id, fullRecord);
    return fullRecord;
  }

  public findByRun(runId: string): ArtifactRecord[] {
    return Array.from(this.records.values()).filter((r) => r.runId === runId);
  }

  public getAll(): ArtifactRecord[] {
    return Array.from(this.records.values());
  }

  public clear(): void {
    this.records.clear();
  }
}

export const artifactRepository = new ArtifactRepository();

export const artifactStore = {
  listByRun(runId: string): ArtifactRecord[] {
    return artifactRepository.findByRun(runId);
  },
};

export async function collectArtifacts(
  sandbox: SandboxHandle,
  rt: SandboxRuntime = runtime
): Promise<ArtifactRecord[]> {
  const files = await rt.findAllowedFiles(sandbox.containerId, artifactRules);
  const artifacts: ArtifactRecord[] = [];

  for (const file of files) {
    const content = await rt.readFile(
      sandbox.containerId,
      file.path,
      file.maxBytes
    );

    const safeContent = redact(content);
    const safeBuffer = Buffer.isBuffer(safeContent)
      ? safeContent
      : Buffer.from(typeof safeContent === "string" ? safeContent : JSON.stringify(safeContent));

    const sha256 = crypto.createHash("sha256").update(safeBuffer).digest("hex");
    const objectKey = `runs/${sandbox.runId}/artifacts/${crypto.randomUUID()}`;

    await objectStore.put(objectKey, safeBuffer);

    const artifact = await artifactRepository.create({
      tenantId: sandbox.tenantId,
      workspaceId: sandbox.workspaceId,
      runId: sandbox.runId,
      stepId: sandbox.stepId,
      artifactType: file.type as ArtifactType,
      objectKey,
      contentType: file.contentType,
      sizeBytes: safeBuffer.length,
      sha256,
      sensitivity: "internal",
    });

    artifacts.push(artifact);
  }

  return artifacts;
}

export class ArtifactCollector {
  public async persistArtifact(params: {
    tenantId?: string;
    workspaceId?: string;
    runId: string;
    stepId?: string;
    type: ArtifactType;
    content: string | Buffer;
    contentType: string;
  }): Promise<ArtifactRecord> {
    const safeContent = redact(params.content);
    const safeBuffer = Buffer.isBuffer(safeContent)
      ? safeContent
      : Buffer.from(typeof safeContent === "string" ? safeContent : JSON.stringify(safeContent));

    const sha256 = crypto.createHash("sha256").update(safeBuffer).digest("hex");
    const objectKey = `runs/${params.runId}/artifacts/${crypto.randomUUID()}`;

    await objectStore.put(objectKey, safeBuffer);

    return artifactRepository.create({
      tenantId: params.tenantId,
      workspaceId: params.workspaceId,
      runId: params.runId,
      stepId: params.stepId,
      artifactType: params.type,
      objectKey,
      contentType: params.contentType,
      sizeBytes: safeBuffer.length,
      sha256,
      sensitivity: "internal",
    });
  }
}

export const artifactCollector = new ArtifactCollector();
export type Artifact = ArtifactRecord;

