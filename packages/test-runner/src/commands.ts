/**
 * AI Workbench - Test Commands & Framework Detection
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

export interface TestCommand {
  name: string;
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  required: boolean;
}

export interface ProjectManifest {
  packageManager?: "pnpm" | "npm" | "yarn";
  python?: boolean;
  scripts?: Record<string, string>;
}

export function detectTestCommands(manifest: ProjectManifest): TestCommand[] {
  if (manifest.packageManager === "pnpm") {
    return [
      {
        name: "unit",
        executable: "pnpm",
        args: ["test", "--if-present"],
        cwd: ".",
        timeoutMs: 10 * 60_000,
        required: true,
      },
    ];
  }

  if (manifest.python) {
    return [
      {
        name: "pytest",
        executable: "pytest",
        args: ["-q"],
        cwd: ".",
        timeoutMs: 10 * 60_000,
        required: true,
      },
    ];
  }

  return [
    {
      name: "unit",
      executable: "npm",
      args: ["test"],
      cwd: ".",
      timeoutMs: 10 * 60_000,
      required: true,
    },
  ];
}
