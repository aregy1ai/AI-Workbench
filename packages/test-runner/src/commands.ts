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
  packageManager?: "bun" | "pnpm" | "npm" | "yarn";
  python?: boolean;
  scripts?: Record<string, string>;
}

function packageManagerTestCommand(
  packageManager: NonNullable<ProjectManifest["packageManager"]>,
): TestCommand {
  const args =
    packageManager === "bun"
      ? ["run", "test"]
      : ["run", "test"];

  return {
    name: "unit",
    executable: packageManager,
    args,
    cwd: ".",
    timeoutMs: 10 * 60_000,
    required: true,
  };
}

export function detectTestCommands(manifest: ProjectManifest): TestCommand[] {
  if (manifest.packageManager === "bun") {
    return [packageManagerTestCommand("bun")];
  }

  if (manifest.packageManager === "pnpm") {
    return [packageManagerTestCommand("pnpm")];
  }

  if (manifest.packageManager === "npm") {
    return [packageManagerTestCommand("npm")];
  }

  if (manifest.packageManager === "yarn") {
    return [packageManagerTestCommand("yarn")];
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
      args: ["run", "test"],
      cwd: ".",
      timeoutMs: 10 * 60_000,
      required: true,
    },
  ];
}
