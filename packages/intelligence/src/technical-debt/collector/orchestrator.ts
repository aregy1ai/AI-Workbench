import { Evidence } from "../contracts/evidence";
import { canonicalToolOutputDigest } from "./specialized-normalizers";
import { sha256Digest } from "./digest";
import { normalizeToolOutput as normalizeRegisteredToolOutput } from "./registry";
import { getToolDefinition } from "./tool-registry";
import {
  PinnedSource,
  ToolCommandSpec,
  ToolInvocation,
  ToolOutputEnvelope,
} from "./types";

export interface TdiCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface TdiToolExecutor {
  execute(input: {
    executable: string;
    args: string[];
    cwd: string;
    env: Record<string, string>;
    timeoutMs: number;
    maxOutputBytes: number;
  }): Promise<TdiCommandResult>;

  readTextFile(path: string, maxBytes: number): Promise<string>;
}

export interface TdiScanRequest {
  source: PinnedSource;
  toolIds: readonly string[];
  timeoutMs?: number;
  maxOutputBytes?: number;
  configDigestByTool?: Readonly<Record<string, string>>;
  ruleSetByTool?: Readonly<Record<string, string>>;
  databaseVersionByTool?: Readonly<Record<string, string>>;
}

export interface TdiToolRun {
  toolId: string;
  version: string;
  success: boolean;
  commands: readonly ToolCommandSpec[];
  durationMs: number;
  evidence: readonly Evidence[];
  rawOutputDigest?: string;
  failureReason?: string;
}

export interface TdiScanResult {
  source: PinnedSource;
  tools: readonly TdiToolRun[];
  evidence: readonly Evidence[];
}

function outputPath(source: PinnedSource, toolId: string): string {
  const safe = toolId.replace(/[^A-Za-z0-9._-]/g, "_");
  return source.sourceRoot + "/.tdi-output/" + safe + ".out";
}

export class TdiScanOrchestrator {
  constructor(private readonly executor: TdiToolExecutor) {}

  public async scan(request: TdiScanRequest): Promise<TdiScanResult> {
    const timeoutMs = request.timeoutMs ?? 20 * 60_000;
    const maxOutputBytes = request.maxOutputBytes ?? 100 * 1024 * 1024;

    const runs: TdiToolRun[] = [];
    const allEvidence: Evidence[] = [];

    for (const toolId of request.toolIds) {
      const definition = getToolDefinition(toolId);
      const resultPath = outputPath(request.source, toolId);
      const commands = definition.buildCommands(request.source.sourceRoot, resultPath);
      const started = Date.now();
      let output = "";
      let stderr = "";
      let exitCode = 0;
      let failureReason: string | undefined;

      try {
        for (const command of commands) {
          const result = await this.executor.execute({
            executable: command.executable,
            args: command.args,
            cwd: request.source.sourceRoot,
            env: {
              CI: "true",
              NODE_ENV: "production",
            },
            timeoutMs,
            maxOutputBytes,
          });

          stderr += result.stderr;

          if (result.exitCode !== 0) {
            exitCode = result.exitCode;
            failureReason = "TOOL_EXIT_" + result.exitCode;
            break;
          }

          if (command.outputTarget === "stdout") {
            output = result.stdout;
          } else {
            output = await this.executor.readTextFile(resultPath, maxOutputBytes);
          }
        }

        if (failureReason) {
          runs.push({
            toolId,
            version: definition.version,
            success: false,
            commands,
            durationMs: Date.now() - started,
            evidence: [],
            failureReason,
          });
          continue;
        }

        const invocation: ToolInvocation = {
          toolId,
          version: definition.version,
          executable: definition.executable,
          args: commands.flatMap((command) => command.args),
          outputFormat: definition.outputFormat,
          configDigest: request.configDigestByTool?.[toolId] ?? "sha256:" + "0".repeat(64),
          ruleSet: request.ruleSetByTool?.[toolId],
          databaseVersion: request.databaseVersionByTool?.[toolId],
        };

        const envelope: ToolOutputEnvelope = {
          source: request.source,
          invocation: {
            ...invocation,
            args: [...invocation.args],
          },
          stdout: output,
          stderr,
          exitCode,
          rawOutputDigest: sha256Digest(output),
          executionEnvelopeDigest: canonicalToolOutputDigest({
            source: request.source,
            invocation,
            stdout: output,
            stderr,
            exitCode,
          }),
        };

        const evidence = normalizeRegisteredToolOutput(envelope);
        allEvidence.push(...evidence);

        runs.push({
          toolId,
          version: definition.version,
          success: true,
          commands,
          durationMs: Date.now() - started,
          evidence,
          rawOutputDigest: envelope.rawOutputDigest,
        });
      } catch (error) {
        failureReason = error instanceof Error ? error.message : String(error);
        runs.push({
          toolId,
          version: definition.version,
          success: false,
          commands,
          durationMs: Date.now() - started,
          evidence: [],
          failureReason,
        });
      }
    }

    return { source: request.source, tools: runs, evidence: allEvidence };
  }
}
