import { AuditHashChainLedger } from "../../packages/audit/src/hash-chain";

export function runAuditHashChainTestSuite(): {
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

  test("audit events use real SHA-256 digests", () => {
    const ledger = new AuditHashChainLedger();
    const event = ledger.append({
      tenantId: "tenant-a",
      workspaceId: "workspace-a",
      actorId: "actor-a",
      eventType: "TDI_SCAN_STARTED",
      payloadSummary: "scan started",
      metadata: { commit: "22c1ace005ee89f4bd5c16df9f60a4592fa972cb" },
    });
    if (!/^sha256:[0-9a-f]{64}$/.test(event.payloadHash)) {
      throw new Error("payload hash is not cryptographic SHA-256");
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(event.eventHash)) {
      throw new Error("event hash is not cryptographic SHA-256");
    }
    if (!ledger.verifyIntegrity().intact) throw new Error("new chain failed integrity");
  });

  test("payload tampering is detected", () => {
    const ledger = new AuditHashChainLedger();
    ledger.append({
      tenantId: "tenant-a",
      workspaceId: "workspace-a",
      actorId: "actor-a",
      eventType: "TDI_DECISION",
      payloadSummary: "PASS",
    });
    ledger.tamperWithEvent(0, "BLOCK");
    const result = ledger.verifyIntegrity();
    if (result.intact || result.message !== "AUDIT_PAYLOAD_TAMPERED") {
      throw new Error("payload tampering was not detected");
    }
  });

  test("event identity tampering is detected", () => {
    const ledger = new AuditHashChainLedger();
    ledger.append({
      tenantId: "tenant-a",
      workspaceId: "workspace-a",
      actorId: "actor-a",
      eventType: "TDI_DECISION",
      payloadSummary: "REVIEW",
    });
    const event = ledger.getEvents()[0];
    event.workspaceId = "workspace-b";
    const result = ledger.verifyIntegrity();
    if (result.intact || result.message !== "AUDIT_EVENT_HASH_MISMATCH") {
      throw new Error("event identity tampering was not detected");
    }
  });

  return results;
}
