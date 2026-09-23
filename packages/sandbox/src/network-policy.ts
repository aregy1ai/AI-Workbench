/**
 * AI Workbench - Network Policy Enforcer & Host Allowlist
 * Sprint 5: Sandbox Scheduler & GitHub Adapter
 */

import { SandboxProfile } from "./profiles";

const FORBIDDEN_METADATA_AND_LOCAL_HOSTS = new Set([
  "169.254.169.254", // Cloud instance metadata
  "metadata.google.internal",
  "metadata",
  "127.0.0.1",
  "localhost",
  "::1",
  "0.0.0.0",
]);

export function validateNetworkRequest(
  profile: SandboxProfile,
  requestedHosts: string[]
): void {
  if (profile.networkMode === "none") {
    if (requestedHosts.length > 0) {
      throw new Error("NETWORK_NOT_ALLOWED");
    }
    return;
  }

  for (const host of requestedHosts) {
    const normalized = host.toLowerCase().trim();

    if (FORBIDDEN_METADATA_AND_LOCAL_HOSTS.has(normalized)) {
      throw new Error(`NETWORK_HOST_NOT_ALLOWED:${host}`);
    }

    if (!profile.allowedHosts.includes(normalized)) {
      throw new Error(`NETWORK_HOST_NOT_ALLOWED:${host}`);
    }
  }
}
