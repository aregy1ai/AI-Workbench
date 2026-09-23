/**
 * AI Workbench - Test Execution Runner
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

import { SandboxHandle } from "../../sandbox/src/cleanup";
import { TestCommand } from "./commands";
import { TestCommandResult, TestRunResult } from "./reports";
import { runRepository } from "../../runs/src/run-repository";

export interface TestExecutor {
  execute(
    sandbox: SandboxHandle,
    command: {
      executable: string;
      args: string[];
      cwd: string;
      env: Record<string, string>;
      timeoutMs: number;
      maxOutputBytes: number;
    }
  ): Promise<{ exitCode: number; stdout: string; stderr: string; durationMs: number }>;
}

export class TestRunner {
  public async run(
    sandbox: SandboxHandle,
    commands: TestCommand[],
    executor: TestExecutor
  ): Promise<TestRunResult> {
    const results: TestCommandResult[] = [];

    for (const command of commands) {
      await runRepository.assertExecutable(
        sandbox.runId,
        sandbox.cancellationEpoch
      );

      const result = await executor.execute(sandbox, {
        executable: command.executable,
        args: command.args,
        cwd: command.cwd,
        env: {
          CI: "true",
          NODE_ENV: "test",
        },
        timeoutMs: command.timeoutMs,
        maxOutputBytes: 50 * 1024 * 1024,
      });

      results.push({
        name: command.name,
        required: command.required,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs,
      });

      if (command.required && result.exitCode !== 0) {
        break;
      }
    }

    return {
      passed: results.every((item) => !item.required || item.exitCode === 0),
      results,
    };
  }
}

export const testRunner = new TestRunner();
export type { TestRunResult };
export const runTests = (
  sandbox: SandboxHandle,
  commands: TestCommand[],
  executor: TestExecutor
): Promise<TestRunResult> => testRunner.run(sandbox, commands, executor);
