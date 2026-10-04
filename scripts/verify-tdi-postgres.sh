#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_initial.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/022_technical_debt.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/023_tdi_evidence_relationships.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/024_tdi_text_identity.sql

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'tdi_scans',
    'tdi_evidence',
    'tdi_findings',
    'tdi_debt_records',
    'tdi_decisions',
    'tdi_finding_evidence',
    'tdi_debt_evidence'
  ] LOOP
    IF to_regclass(table_name) IS NULL THEN
      RAISE EXCEPTION 'TDI table missing: %', table_name;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    WHERE c.relname = 'tdi_scans' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS missing on tdi_scans';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    WHERE c.relname = 'tdi_finding_evidence' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS missing on tdi_finding_evidence';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tdi_evidence_scan_identity_fk'
  ) THEN
    RAISE EXCEPTION 'Evidence-to-scan identity FK missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tdi_fe_evidence_fk'
  ) THEN
    RAISE EXCEPTION 'Finding-to-evidence FK missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tdi_de_evidence_fk'
  ) THEN
    RAISE EXCEPTION 'Debt-to-evidence FK missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name IN ('tdi_evidence', 'tdi_findings', 'tdi_debt_records', 'tdi_decisions')
      AND column_name = 'id'
      AND data_type = 'uuid'
  ) THEN
    RAISE EXCEPTION 'TDI contract identity still uses UUID';
  END IF;
END
$$;
SQL

echo "TDI PostgreSQL schema verification passed."
