-- =============================================================================
-- Meridian Core Banking Platform
-- Migration 002: Trigger functions
--
-- Two independent trigger mechanisms:
--   1. set_updated_at()   — keeps `updated_at` accurate on every UPDATE,
--                            without every service method having to
--                            remember to set it manually.
--   2. log_audit_event()  — writes a row into audit_logs for every INSERT/
--                            UPDATE/DELETE on the tables that matter for
--                            compliance, capturing the full before/after
--                            row as JSONB. This means the audit trail
--                            cannot be silently skipped by an application
--                            bug — it happens at the database layer.
--
-- Design trade-off worth stating explicitly: business logic for *money
-- movement itself* (deposits/withdrawals/transfers) intentionally lives in
-- the backend application layer (inside a DB transaction), not in stored
-- procedures. This keeps that logic in version-controlled, unit-testable
-- TypeScript rather than harder-to-test PL/pgSQL, while still using the
-- database's transactional guarantees (BEGIN/COMMIT, row locking) for
-- atomicity. Auditing, by contrast, lives at the DB layer on purpose,
-- because an audit trail you can accidentally forget to write from the
-- app is a much weaker audit trail.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Function: set_updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customers_set_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_accounts_set_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- Function: log_audit_event
--
-- Generic audit trigger, reusable across tables via to_jsonb(OLD)/(NEW).
-- performed_by is read from a session-local setting
-- (`meridian.performed_by`) that the backend sets at the start of each
-- request via `SET LOCAL`, so the audit row can attribute the change to
-- the authenticated api_user (or 'customer:<id>' for self-service flows)
-- without threading that value through every SQL statement individually.
-- If the app never sets it (e.g. a manual psql session), it safely falls
-- back to 'system'.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_performed_by VARCHAR(100);
BEGIN
    BEGIN
        v_performed_by := current_setting('meridian.performed_by', true);
    EXCEPTION WHEN OTHERS THEN
        v_performed_by := NULL;
    END;

    IF v_performed_by IS NULL OR v_performed_by = '' THEN
        v_performed_by := 'system';
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, old_value, new_value)
        VALUES (TG_TABLE_NAME, (to_jsonb(NEW) ->> TG_ARGV[0])::UUID, 'INSERT', v_performed_by, NULL, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, old_value, new_value)
        VALUES (TG_TABLE_NAME, (to_jsonb(NEW) ->> TG_ARGV[0])::UUID, 'UPDATE', v_performed_by, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, old_value, new_value)
        VALUES (TG_TABLE_NAME, (to_jsonb(OLD) ->> TG_ARGV[0])::UUID, 'DELETE', v_performed_by, to_jsonb(OLD), NULL);
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Note: TG_ARGV[0] is the name of the primary key column on the target
-- table, passed in at CREATE TRIGGER time below, so the same function
-- works across tables with differently-named primary keys.

CREATE TRIGGER trg_customers_audit
    AFTER INSERT OR UPDATE OR DELETE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_event('customer_id');

CREATE TRIGGER trg_accounts_audit
    AFTER INSERT OR UPDATE OR DELETE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_event('account_id');

CREATE TRIGGER trg_transactions_audit
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_event('transaction_id');

-- api_users is intentionally NOT wired to this trigger — see the comment
-- on that table in migration 001. If staff-account changes need auditing
-- later, write a dedicated trigger that redacts password_hash rather than
-- reusing this generic one.
