-- 015_nonces.sql
-- Execution Nonces for Replay Attack Prevention

CREATE TABLE IF NOT EXISTS execution_nonces (
  nonce text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('reserved', 'consumed')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Foreign Key Constraints linking Sprint 4 tables
ALTER TABLE tool_calls
DROP CONSTRAINT IF EXISTS tool_calls_policy_decision_fk;

ALTER TABLE tool_calls
ADD CONSTRAINT tool_calls_policy_decision_fk
FOREIGN KEY (policy_decision_id)
REFERENCES policy_decisions(id) ON DELETE SET NULL;

ALTER TABLE tool_calls
DROP CONSTRAINT IF EXISTS tool_calls_approval_fk;

ALTER TABLE tool_calls
ADD CONSTRAINT tool_calls_approval_fk
FOREIGN KEY (approval_id)
REFERENCES approvals(id) ON DELETE SET NULL;

ALTER TABLE tool_calls
DROP CONSTRAINT IF EXISTS tool_calls_secret_lease_fk;

ALTER TABLE tool_calls
ADD CONSTRAINT tool_calls_secret_lease_fk
FOREIGN KEY (secret_lease_id)
REFERENCES secret_leases(id) ON DELETE SET NULL;
