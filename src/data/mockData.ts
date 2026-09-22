import { TenantInfo, DiffHunk } from "../types";

export const SAMPLE_TENANTS: TenantInfo[] = [
  {
    id: "tenant_acme_corp",
    name: "Acme Enterprise Corp",
    plan: "Enterprise Shield",
    budgetLimit: 50.0,
    workspaces: [
      {
        id: "ws_acme_core",
        name: "Core Platform & Infrastructure",
        repositories: [
          {
            id: "repo_payment_gw",
            fullName: "acme-corp/payment-gateway",
            defaultBranch: "main",
            language: "TypeScript",
          },
          {
            id: "repo_auth_svc",
            fullName: "acme-corp/auth-service",
            defaultBranch: "main",
            language: "TypeScript",
          },
        ],
      },
    ],
  },
  {
    id: "tenant_fintech_global",
    name: "FinTech Global Security",
    plan: "FinServ Regulated",
    budgetLimit: 100.0,
    workspaces: [
      {
        id: "ws_fintech_banking",
        name: "OpenBanking Integration",
        repositories: [
          {
            id: "repo_ledger_api",
            fullName: "fintech-global/core-ledger-api",
            defaultBranch: "main",
            language: "TypeScript / Go",
          },
        ],
      },
    ],
  },
];

export const SAMPLE_DIFF: DiffHunk[] = [
  {
    file: "src/auth/session-manager.ts",
    oldPath: "src/auth/session-manager.ts",
    newPath: "src/auth/session-manager.ts",
    changes: [
      { type: "context", line: "  export async function validateSessionToken(token: string) {" },
      { type: "delete", line: "-   const session = memoryCache.get(token);" },
      { type: "delete", line: "-   if (session) return session;" },
      { type: "add", line: "+   // FIX: Atomically query distributed store with tenant scoping" },
      { type: "add", line: "+   const session = await distributedStore.getWithLock(token);" },
      { type: "add", line: "+   if (!session || session.isRevoked) {" },
      { type: "add", line: "+     throw new SecurityError('SESSION_REVOKED');" },
      { type: "add", line: "+   }" },
      { type: "context", line: "    return session;" },
      { type: "context", line: "  }" },
    ],
  },
  {
    file: "tests/auth/session.test.ts",
    oldPath: "tests/auth/session.test.ts",
    newPath: "tests/auth/session.test.ts",
    changes: [
      { type: "context", line: "  describe('Session Token Concurrency', () => {" },
      { type: "add", line: "+   it('rejects concurrent requests after token revocation', async () => {" },
      { type: "add", line: "+     const token = await createTestSession();" },
      { type: "add", line: "+     await revokeSession(token);" },
      { type: "add", line: "+     await expect(validateSessionToken(token)).rejects.toThrow('SESSION_REVOKED');" },
      { type: "add", line: "+   });" },
      { type: "context", line: "  });" },
    ],
  },
];
