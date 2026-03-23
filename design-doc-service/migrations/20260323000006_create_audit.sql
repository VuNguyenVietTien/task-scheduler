CREATE TABLE document_audit (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by BIGINT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON document_audit(entity_type, entity_id);
CREATE INDEX idx_audit_changed_at ON document_audit(changed_at DESC);

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id BIGINT;
BEGIN
    BEGIN
        current_user_id := current_setting('app.user_id')::BIGINT;
    EXCEPTION WHEN OTHERS THEN
        current_user_id := 0;
    END;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO document_audit(entity_type, entity_id, action, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), current_user_id);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO document_audit(entity_type, entity_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), current_user_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO document_audit(entity_type, entity_id, action, old_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), current_user_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to audited tables
CREATE TRIGGER audit_design_documents
    AFTER INSERT OR UPDATE OR DELETE ON design_documents
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_screens
    AFTER INSERT OR UPDATE OR DELETE ON screens
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_components
    AFTER INSERT OR UPDATE OR DELETE ON components
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
