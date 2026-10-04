import { detectTestCommands } from "../../packages/test-runner/src/commands";

export function runTestRunnerCommandSuite(): {
  name: string;
  passed: boolean;
  details?: string;
}[] {
  const results: { name: string; passed: boolean; details?: string }[] = [];
  const test = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (e) {
      results.push({ name, passed: false, details: e instanceof Error ? e.message : String(e) });
    }
  };

  test("Bun projects use bun run test", () => {
    const command = detectTestCommands({
      packageManager: "bun",
      scripts: { test: "tsx tests/run-all.ts" },
    })[0];
    if (command.executable !== "bun") throw new Error("Bun executable not selected");
    if (JSON.stringify(command.args) !== JSON.stringify(["run", "test"])) {
      throw new Error("Bun test command is incorrect");
    }
  });

  test("pnpm projects use pnpm run test", () => {
    const command = detectTestCommands({ packageManager: "pnpm" })[0];
    if (command.executable !== "pnpm") throw new Error("pnpm executable not selected");
    if (JSON.stringify(command.args) !== JSON.stringify(["run", "test"])) {
      throw new Error("pnpm test command is incorrect");
    }
  });

  return results;
}
