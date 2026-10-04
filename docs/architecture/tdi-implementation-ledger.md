# TDI Implementation Ledger

Date: 2026-10-04  
Branch: `tdi-v1-foundation`  
Baseline: `22c1ace005ee89f4bd5c16df9f60a4592fa972cb`

## Mission

Build Technical Debt Intelligence as an evidence-first governance subsystem while preserving the existing AI Workbench security, policy, sandbox, audit, tenant-isolation, and execution boundaries.

## Non-negotiable architecture

```text
Evidence
   ↓
Finding
   ↓
Debt Record
   ↓
Deterministic Scorer
   ↓
Trusted PolicyFacts
   ↓
Deterministic Debt Gate
   ↓
Decision
   ↓
Registry / Report
```

AI is an analysis source, not an authority.

## Decisions recorded

### D-001 — Evidence-first

All debt claims must point to evidence tied to a tenant, workspace, repository and exact commit.

### D-002 — AI cannot decide

Finding does not contain PASS/REVIEW/BLOCK. The gate receives trusted deterministic facts. AI severity is never enough to manufacture a blocking classification.

### D-003 — Deterministic scoring

The score is replayable from persisted inputs and a versioned scoring policy.

Current policy:

- low severity = 0.25
- medium severity = 0.50
- high severity = 0.90
- critical severity = 1.00
- remediation base = 40 hours

### D-004 — Fail closed

Evidence, provenance, or contract integrity failures produce BLOCK.

### D-005 — No custom analyzers

Static-analysis, dependency, SBOM, secret-scanning, and architecture engines should be reused from mature projects. Eagle owns adapters, evidence normalization, provenance, and policy.

### D-006 — No working-tree proof

Pinned scans must use an immutable source/checkout provider. `execSync('git ...')` is not the TDI source of truth.

### D-007 — Tool output is untrusted

Every tool result is parsed, validated, attributed to the pinned commit, hashed, and normalized before policy evaluation.

### D-008 — Legacy relationship arrays are transitional

`tdi_finding_evidence` and `tdi_debt_evidence` junction tables are the authoritative relationships for new records. Legacy `evidence_ids` arrays remain temporarily for compatibility.

### D-009 — Real cryptography

The audit ledger uses actual SHA-256. Execution context signing uses HMAC-SHA256 with a cryptographically random nonce. Hard-coded signing secrets are forbidden.

### D-010 — CI must match the repository lockfile

The repository contains `bun.lock`; the CI validation path now uses Bun rather than invoking missing pnpm scripts.

## Implementation completed in this branch

### TDI contracts

- Evidence contract and SHA-256 format validation.
- Finding contract without gate decision.
- Debt Record contract.
- Decision contract with deterministic decision fingerprint.

### Deterministic policy/scoring

- Versioned scoring policy.
- Trusted PolicyFacts.
- Deterministic Debt Gate.
- Replay-stable decision fingerprint.

### Evidence infrastructure

- Canonical JSON.
- Real SHA-256 digest helpers.
- Deterministic evidence IDs.
- Generic SARIF normalization.
- actionlint JSON normalization.
- Specialized normalizers for dependency-cruiser, Knip, Scorecard, Syft, Gitleaks.
- Tool adapter registry.
- External tool registry with current target versions.

### Database

- TDI scans/evidence/findings/debt/decisions schema.
- RLS + FORCE RLS.
- Composite tenant/scope constraints.
- Evidence↔scan commit identity enforcement.
- Junction tables for finding↔evidence and debt↔evidence.

### Security hardening

- HMAC-SHA256 execution-context signatures.
- Cryptographic nonce generation.
- Timing-safe signature comparison.
- Removal of hard-coded signer default secret.
- Real SHA-256 audit hash chaining.
- Audit payload re-computation during integrity verification.

### CI/test plumbing

- `typecheck`, `test`, and `test:security` scripts.
- Bun 1.4.2 as the recorded package manager baseline.
- CI now runs on `main` and `tdi-v1-foundation`.
- Explicit TDI/collector tests are part of the test entrypoint.

## External tooling evidence

### Verified current targets as of 2026-10-04

- CodeQL CLI 2.27.1
- Semgrep 1.179.0
- OSV-Scanner 2.6.0
- Trivy 0.74.0
- actionlint 1.7.12
- dependency-cruiser 18.1.0
- Knip 6.31.0
- OpenSSF Scorecard 5.5.0
- Syft 1.54.0
- Gitleaks: pin at adoption

Version selection must be revisited at controlled upgrade points, not silently changed.

## Verification status

### Repository-source verification

NOT COMPLETE.

Reason: the current `SnapshotService` implementation is an in-memory simulation and explicitly does not implement real clone/tree hashing.

### Third-party binary execution

NOT COMPLETE.

The adapter/normalization boundary is implemented, but every selected binary has not yet been executed against a pinned repository snapshot in the project CI.

### Local CI execution

NOT COMPLETE.

The current execution environment cannot resolve GitHub externally, so local `git clone`/network execution is unavailable.

### GitHub Actions validation

The branch now contains a CI workflow that can execute the configured checks on GitHub. The latest workflow run must be inspected after GitHub records it before calling the branch fully verified.

## Phase roadmap

### Phase 0 — Security baseline

- main branch/ruleset protection
- cryptographic audit
- signer secret provisioning
- CI/package command consistency

### Phase 1 — Contracts

Completed.

### Phase 2 — Evidence

Partially completed:
- normalization/adapters completed
- pinned-source implementation and real tool execution remain

### Phase 3 — Registry

Schema completed; DB execution and repository service remain.

### Phase 4 — Scoring

Completed for v1 deterministic policy.

### Phase 5 — Debt Gate

Completed architecturally; production acceptance remains conditional on trusted PolicyFacts and runtime verification.

### Phase 6 — AI Analyzer

Intentionally deferred until evidence pipeline is verified.

### Phase 7 — CI integration

In progress; workflow updated but GitHub run must provide execution proof.

### Phase 8 — Dashboard

Deferred.

### Phase 9 — Remediation

Out of scope for TDI v1.

## Acceptance criteria for Production Gate

TDI is not production-gate-ready until all of the following are true:

1. main protection is active;
2. signer has no hard-coded secret and production secret is provisioned;
3. audit hashes are real SHA-256;
4. repository source is pinned and immutable;
5. external tools execute in the real isolated runtime;
6. tool versions/configuration/rule sets are recorded;
7. raw and normalized result digests are verified;
8. tenant/workspace/repository/commit relationships are enforced by database constraints;
9. collector and policy tests pass in GitHub Actions;
10. deterministic Decision replay reproduces the same decision fingerprint;
11. AI cannot create a BLOCK path;
12. a human approval path exists for REVIEW cases.

## References

- TDI external tool strategy: `docs/architecture/tdi-external-tooling-strategy.md`
- TDI project coverage: `docs/architecture/tdi-project-coverage.md`
- TDI collector contracts: `packages/intelligence/src/technical-debt/collector/`
- TDI database migration: `db/migrations/022_technical_debt.sql`
- TDI relationship hardening: `db/migrations/023_tdi_evidence_relationships.sql`
