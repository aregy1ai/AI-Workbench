import {
  Database,
  RequestContext,
  Transaction,
  withTenantContext,
} from "../../../../database/src/client";
import { DebtGateDecisionRecord } from "../contracts/decision";
import { DebtRecord } from "../contracts/debt-record";
import { Evidence } from "../contracts/evidence";
import { Finding } from "../contracts/finding";

export interface TdiScanRecord {
  id: string;
  tenantId: string;
  workspaceId: string;
  repositoryId: string;
  commitSha: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  collectorVersion: string;
  analyzerVersion?: string;
  startedAt?: string;
  completedAt?: string;
  failureCode?: string;
}

export interface TdiRegistryBundle {
  scan: TdiScanRecord;
  evidence: readonly Evidence[];
  findings: readonly Finding[];
  debts: readonly DebtRecord[];
  decisions: readonly DebtGateDecisionRecord[];
}

export interface TdiRegistryRepository {
  persistBundle(
    context: RequestContext,
    bundle: TdiRegistryBundle,
  ): Promise<void>;
}

function dateOrNow(value?: string): string {
  return value ?? new Date().toISOString();
}

function uuid(value: string, code: string): string {
  if (!/^[0-9a-f-]{20,64}$/i.test(value)) throw new Error(code);
  return value;
}

function assertText(value: string, code: string): void {
  if (!value || !value.trim()) throw new Error(code);
}

function insertEvidence(tx: Transaction, scanId: string, evidence: Evidence): Promise<void> {
  return tx.execute(
    `INSERT INTO tdi_evidence
      (id, tenant_id, workspace_id, scan_id, evidence_type, source,
       repository_id, commit_sha, path, line_start, line_end,
       collected_at, content_digest, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
    [
      evidence.id,
      evidence.tenantId,
      evidence.workspaceId,
      scanId,
      evidence.type,
      evidence.source,
      evidence.repositoryId,
      evidence.commitSha,
      evidence.path ?? null,
      evidence.lineStart ?? null,
      evidence.lineEnd ?? null,
      dateOrNow(evidence.collectedAt),
      evidence.contentDigest,
      JSON.stringify(evidence.data),
    ],
  );
}

function insertFinding(tx: Transaction, scanId: string, finding: Finding, tenantId: string, workspaceId: string): Promise<void> {
  return tx.execute(
    `INSERT INTO tdi_findings
      (id, tenant_id, workspace_id, scan_id, finding_key, category,
       severity, confidence, evidence_ids, affected_paths,
       affected_symbols, recommendation, explanation)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10::text[],$11::text[],$12,$13)`,
    [
      finding.id,
      tenantId,
      workspaceId,
      scanId,
      finding.id,
      finding.category,
      finding.severity,
      finding.confidence,
      "{" + finding.evidenceIds.join(",") + "}",
      "{" + finding.affectedPaths.join(",") + "}",
      "{" + (finding.affectedSymbols ?? []).join(",") + "}",
      finding.recommendation,
      finding.explanation ?? null,
    ],
  );
}

function insertDebt(
  tx: Transaction,
  scanId: string,
  debt: DebtRecord,
  tenantId: string,
  workspaceId: string,
): Promise<void> {
  return tx.execute(
    `INSERT INTO tdi_debt_records
      (id, tenant_id, workspace_id, scan_id, finding_id, td_key,
       affected_boundary, repository_id, commit_sha, location_path,
       location_symbols, evidence_ids, evidence_hash, category, severity,
       confidence, impact, risk, change_frequency, remediation_effort_hours,
       debt_score, status, created_at, due_at, closed_at, owner, adr,
       accepted, review_due_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::text[],$12::text[],$13,
             $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)`,
    [
      debt.tdId,
      tenantId,
      workspaceId,
      scanId,
      debt.findingId,
      debt.tdId,
      debt.affectedBoundary ?? null,
      debt.repositoryId,
      debt.commitSha,
      debt.locationPath,
      "{" + debt.locationSymbols.join(",") + "}",
      "{" + debt.evidenceIds.join(",") + "}",
      debt.evidenceHash,
      debt.category,
      debt.severity,
      debt.confidence,
      debt.impact,
      debt.risk,
      debt.changeFrequency,
      debt.remediationEffortHours,
      debt.debtScore,
      debt.status,
      dateOrNow(debt.createdAt),
      debt.dueAt ?? null,
      debt.closedAt ?? null,
      debt.owner ?? null,
      debt.adr ?? null,
      debt.accepted,
      debt.reviewDueAt ?? null,
    ],
  );
}

function insertDecision(
  tx: Transaction,
  decision: DebtGateDecisionRecord,
  tenantId: string,
  workspaceId: string,
): Promise<void> {
  return tx.execute(
    `INSERT INTO tdi_decisions
      (id, tenant_id, workspace_id, td_id, decision, policy_applied,
       policy_version, evidence_verified, reason_code, reason,
       decision_fingerprint, decided_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      decision.id,
      tenantId,
      workspaceId,
      decision.tdId,
      decision.decision,
      decision.policyApplied,
      decision.policyVersion,
      decision.evidenceVerified,
      decision.reasonCode,
      decision.reason,
      decision.decisionFingerprint,
      dateOrNow(decision.decidedAt),
    ],
  );
}

function pgTextArray(values: readonly string[]): string {
  // PostgreSQL text[] literal with conservative escaping.
  return "{" + values.map((value) => '"' + value.replace(/\/g, "\\").replace(/"/g, '\"').replace(/,/g, "\,") + '"').join(",") + "}";
}

export class PostgresTdiRegistryRepository implements TdiRegistryRepository {
  constructor(private readonly db: Database) {}

  async persistBundle(
    context: RequestContext,
    bundle: TdiRegistryBundle,
  ): Promise<void> {
    assertText(context.tenantId, "TDI_REGISTRY_TENANT_REQUIRED");
    assertText(context.actorId, "TDI_REGISTRY_ACTOR_REQUIRED");
    assertText(context.requestId, "TDI_REGISTRY_REQUEST_REQUIRED");
    const scanId = uuid(bundle.scan.id, "TDI_SCAN_ID_INVALID");

    await withTenantContext(this.db, context, async (tx) => {
      await tx.execute(
        `INSERT INTO tdi_scans
          (id, tenant_id, workspace_id, repository_id, commit_sha, status,
           collector_version, analyzer_version, started_at, completed_at, failure_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          scanId,
          bundle.scan.tenantId,
          bundle.scan.workspaceId,
          bundle.scan.repositoryId,
          bundle.scan.commitSha,
          bundle.scan.status,
          bundle.scan.collectorVersion,
          bundle.scan.analyzerVersion ?? null,
          bundle.scan.startedAt ?? null,
          bundle.scan.completedAt ?? null,
          bundle.scan.failureCode ?? null,
        ],
      );

      for (const evidence of bundle.evidence) {
        if (
          evidence.tenantId !== bundle.scan.tenantId ||
          evidence.workspaceId !== bundle.scan.workspaceId ||
          evidence.repositoryId !== bundle.scan.repositoryId ||
          evidence.commitSha !== bundle.scan.commitSha
        ) {
          throw new Error("TDI_REGISTRY_EVIDENCE_SCOPE_MISMATCH");
        }
        await insertEvidence(tx, scanId, evidence);
      }

      for (const finding of bundle.findings) {
        await insertFinding(
          tx,
          scanId,
          finding,
          bundle.scan.tenantId,
          bundle.scan.workspaceId,
        );

        for (const evidenceId of finding.evidenceIds) {
          await tx.execute(
            `INSERT INTO tdi_finding_evidence
              (tenant_id, scan_id, finding_id, evidence_id)
             VALUES ($1,$2,$3,$4)`,
            [bundle.scan.tenantId, scanId, finding.id, evidenceId],
          );
        }
      }

      for (const debt of bundle.debts) {
        if (
          debt.repositoryId !== bundle.scan.repositoryId ||
          debt.commitSha !== bundle.scan.commitSha
        ) {
          throw new Error("TDI_REGISTRY_DEBT_SCOPE_MISMATCH");
        }

        await insertDebt(
          tx,
          scanId,
          debt,
          bundle.scan.tenantId,
          bundle.scan.workspaceId,
        );

        for (const evidenceId of debt.evidenceIds) {
          await tx.execute(
            `INSERT INTO tdi_debt_evidence
              (tenant_id, scan_id, td_id, evidence_id)
             VALUES ($1,$2,$3,$4)`,
            [bundle.scan.tenantId, scanId, debt.tdId, evidenceId],
          );
        }
      }

      for (const decision of bundle.decisions) {
        if (!bundle.debts.some((debt) => debt.tdId === decision.tdId)) {
          throw new Error("TDI_REGISTRY_DECISION_TARGET_MISSING");
        }

        await insertDecision(
          tx,
          decision,
          bundle.scan.tenantId,
          bundle.scan.workspaceId,
        );
      }
    });
  }
}

/**
 * Encode text arrays for callers/tests that need PostgreSQL literals.
 * Kept exported so DB adapters use exactly one escaping implementation.
 */
export function toPgTextArray(values: readonly string[]): string {
  return pgTextArray(values);
}
