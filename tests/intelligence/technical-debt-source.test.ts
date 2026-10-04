import { GitHubCommitSourceProvider } from "../../packages/intelligence/src/technical-debt";

const commitSha = "22c1ace005ee89f4bd5c16df9f60a4592fa972cb";
const blobSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

export async function runTechnicalDebtSourceTestSuite(): Promise<{
  name: string;
  passed: boolean;
  details?: string;
}[]> {
  const results: { name: string; passed: boolean; details?: string }[] = [];
  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (e) {
      results.push({
        name,
        passed: false,
        details: e instanceof Error ? e.message : String(e),
      });
    }
  };

  await test("source provider rejects a truncated tree", async () => {
    let calls = 0;
    const provider = new GitHubCommitSourceProvider(
      { getToken: async () => "github-token-for-test-1234567890" },
      {
        fetchImpl: async (input) => {
          calls++;
          const url = String(input);
          if (url.includes("/commits/")) {
            return new Response(JSON.stringify({ sha: commitSha }), { status: 200 });
          }
          return new Response(JSON.stringify({
            sha: "tree-sha-1",
            truncated: true,
            tree: [],
          }), { status: 200 });
        },
      },
    );

    await provider.getSnapshot({
      tenantId: "tenant-a",
      workspaceId: "workspace-a",
      repositoryId: "aregy1ai/AI-Workbench",
      commitSha,
    }).then(
      () => { throw new Error("truncated tree was accepted"); },
      (error: unknown) => {
        if (!(error instanceof Error) || error.message !== "TDI_TREE_TRUNCATED_FAIL_CLOSED") {
          throw error;
        }
      },
    );

    if (calls !== 2) throw new Error("unexpected GitHub request count");
  });

  await test("source provider verifies exact commit and tree deterministically", async () => {
    const responses = [
      { sha: commitSha },
      {
        sha: "tree-sha-123",
        truncated: false,
        tree: [
          { path: "z.ts", mode: "100644", type: "blob", sha: blobSha, size: 2 },
          { path: "a.ts", mode: "100644", type: "blob", sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", size: 1 },
        ],
      },
    ];
    let index = 0;
    const provider = new GitHubCommitSourceProvider(
      { getToken: async () => "github-token-for-test-1234567890" },
      {
        fetchImpl: async () =>
          new Response(JSON.stringify(responses[index++]), { status: 200 }),
      },
    );

    const input = {
      tenantId: "tenant-a",
      workspaceId: "workspace-a",
      repositoryId: "aregy1ai/AI-Workbench",
      commitSha,
    };

    const first = await provider.getSnapshot(input);
    index = 0;
    const second = await provider.getSnapshot(input);

    if (first.treeDigest !== second.treeDigest) throw new Error("tree digest is not deterministic");
    if (first.files[0]?.path !== "a.ts" || first.files[1]?.path !== "z.ts") {
      throw new Error("tree files are not canonically ordered");
    }
    if (!first.commitVerified) throw new Error("commit was not verified");
  });

  await test("source provider rejects commit pin mismatch", async () => {
    const provider = new GitHubCommitSourceProvider(
      { getToken: async () => "github-token-for-test-1234567890" },
      {
        fetchImpl: async () =>
          new Response(JSON.stringify({ sha: "ffffffffffffffffffffffffffffffffffffffff" }), { status: 200 }),
      },
    );

    await provider.getSnapshot({
      tenantId: "tenant-a",
      workspaceId: "workspace-a",
      repositoryId: "aregy1ai/AI-Workbench",
      commitSha,
    }).then(
      () => { throw new Error("commit mismatch accepted"); },
      (error: unknown) => {
        if (!(error instanceof Error) || error.message !== "TDI_COMMIT_PIN_MISMATCH") {
          throw error;
        }
      },
    );
  });

  await test("source provider hashes exact blob content", async () => {
    const raw = Buffer.from("export const value = 42;\n", "utf8").toString("base64");
    const provider = new GitHubCommitSourceProvider(
      { getToken: async () => "github-token-for-test-1234567890" },
      {
        fetchImpl: async () =>
          new Response(JSON.stringify({
            sha: blobSha,
            encoding: "base64",
            content: raw,
          }), { status: 200 }),
      },
    );

    const result = await provider.readFile({
      tenantId: "tenant-a",
      workspaceId: "workspace-a",
      repositoryId: "aregy1ai/AI-Workbench",
      commitSha,
      blobSha,
    });

    if (result.content !== "export const value = 42;\n") throw new Error("blob content mismatch");
    if (!/^sha256:[0-9a-f]{64}$/.test(result.contentDigest)) {
      throw new Error("blob digest is not SHA-256");
    }
  });

  return results;
}
