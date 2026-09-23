/**
 * AI Workbench - Immutable Sandbox Profiles & Validation
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

export interface SandboxProfile {
  name: string;
  runtime: "gvisor" | "container";
  imageDigest: string;

  cpuLimit: string;
  memoryLimit: string;
  pidsLimit: number;
  timeoutMs: number;
  artifactLimitBytes: number;

  runAsUser: number;
  readOnlyRootFilesystem: boolean;
  allowPrivilegeEscalation: boolean;

  networkMode: "none" | "allowlist";
  allowedHosts: string[];

  credentialTtlMs: number;
}

export const mediumProfile: SandboxProfile = {
  name: "medium",
  runtime: "gvisor",
  imageDigest:
    "sha256:7f9a24bb883c4e12e3a19b5d634289aa8123ef6b43290f11ac8991ea4012abcd",

  cpuLimit: "2",
  memoryLimit: "4Gi",
  pidsLimit: 256,
  timeoutMs: 20 * 60_000,
  artifactLimitBytes: 500 * 1024 * 1024,

  runAsUser: 10001,
  readOnlyRootFilesystem: false,
  allowPrivilegeEscalation: false,

  networkMode: "allowlist",
  allowedHosts: [
    "github.com",
    "api.github.com",
    "proxy.npmjs.org",
  ],

  credentialTtlMs: 10 * 60_000,
};

export const isolatedProfile: SandboxProfile = {
  name: "isolated",
  runtime: "gvisor",
  imageDigest:
    "sha256:7f9a24bb883c4e12e3a19b5d634289aa8123ef6b43290f11ac8991ea4012abcd",

  cpuLimit: "2",
  memoryLimit: "2Gi",
  pidsLimit: 128,
  timeoutMs: 10 * 60_000,
  artifactLimitBytes: 100 * 1024 * 1024,

  runAsUser: 10001,
  readOnlyRootFilesystem: true,
  allowPrivilegeEscalation: false,

  networkMode: "none",
  allowedHosts: [],

  credentialTtlMs: 5 * 60_000,
};

export class ProfileValidator {
  public validate(profile: SandboxProfile): void {
    if (
      !profile.imageDigest ||
      !profile.imageDigest.startsWith("sha256:") ||
      profile.imageDigest.includes("latest")
    ) {
      throw new Error("IMAGE_DIGEST_REQUIRED");
    }

    if (profile.runAsUser === 0) {
      throw new Error("ROOT_EXECUTION_FORBIDDEN");
    }

    if (profile.allowPrivilegeEscalation) {
      throw new Error("PRIVILEGE_ESCALATION_FORBIDDEN");
    }
  }
}

export const profileValidator = new ProfileValidator();

export class ProfileSelector {
  public select(
    taskType: "patch" | "test" | "review",
    networkRequired: boolean = false
  ): SandboxProfile {
    let profile: SandboxProfile;

    switch (taskType) {
      case "review":
        profile = { ...isolatedProfile };
        break;
      case "test":
        profile = networkRequired
          ? { ...mediumProfile }
          : { ...mediumProfile, networkMode: "none", allowedHosts: [] };
        break;
      case "patch":
      default:
        profile = { ...mediumProfile };
        break;
    }

    profileValidator.validate(profile);
    return profile;
  }
}

export const profileSelector = new ProfileSelector();
export const DEFAULT_SANDBOX_PROFILE = mediumProfile;
