BEGIN;
CREATE TABLE auth_credentials (
 tenant_id text NOT NULL,user_id text NOT NULL,login text NOT NULL UNIQUE,password_hash text NOT NULL,
 PRIMARY KEY(tenant_id,user_id),FOREIGN KEY(tenant_id,user_id) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE auth_sessions (
 token_hash text PRIMARY KEY,tenant_id text NOT NULL,user_id text NOT NULL,expires_at timestamptz NOT NULL,
 FOREIGN KEY(tenant_id,user_id) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE configuration_versions (
 tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,version integer NOT NULL CHECK(version>0),
 configuration jsonb NOT NULL,created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,version),FOREIGN KEY(tenant_id,created_by) REFERENCES app_users(tenant_id,id)
);
CREATE TRIGGER configuration_immutable BEFORE UPDATE OR DELETE ON configuration_versions FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();
ALTER TABLE management_pool_policies ADD COLUMN supersedes_policy_id text;
ALTER TABLE management_pool_policies ADD CONSTRAINT supersedes_pool_fk FOREIGN KEY(tenant_id,supersedes_policy_id) REFERENCES management_pool_policies(tenant_id,id);
CREATE UNIQUE INDEX pool_chain_unique ON management_pool_policies(tenant_id,supersedes_policy_id) WHERE supersedes_policy_id IS NOT NULL;
ALTER TABLE product_price_versions ADD COLUMN supersedes_price_id text;
ALTER TABLE product_price_versions ADD CONSTRAINT supersedes_price_fk FOREIGN KEY(tenant_id,supersedes_price_id) REFERENCES product_price_versions(tenant_id,id);
CREATE UNIQUE INDEX price_chain_unique ON product_price_versions(tenant_id,supersedes_price_id) WHERE supersedes_price_id IS NOT NULL;
ALTER TABLE bonus_policies ADD COLUMN supersedes_policy_id text;
ALTER TABLE bonus_policies ADD CONSTRAINT supersedes_bonus_fk FOREIGN KEY(tenant_id,supersedes_policy_id) REFERENCES bonus_policies(tenant_id,id);
CREATE UNIQUE INDEX bonus_chain_unique ON bonus_policies(tenant_id,supersedes_policy_id) WHERE supersedes_policy_id IS NOT NULL;
-- Preserve original cash/pricing source amounts; canonical exact fractions are saved independently.
ALTER TABLE order_items RENAME COLUMN gross_list_value TO gross_list_value_source;
ALTER TABLE order_items RENAME COLUMN discount_amount TO discount_amount_source;
ALTER TABLE order_items RENAME COLUMN net_sales_value TO net_sales_value_source;
ALTER TABLE order_items ADD COLUMN canonical_input jsonb NOT NULL DEFAULT '{}';
ALTER TABLE orders ADD COLUMN entry_source text NOT NULL DEFAULT 'MANUAL' CHECK(entry_source IN ('MANUAL','AMIS'));
ALTER TABLE calculation_periods ADD COLUMN configuration_snapshot jsonb NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX manual_order_number_unique ON orders(tenant_id,order_number) WHERE entry_source='MANUAL';
CREATE UNIQUE INDEX payment_reference_unique ON payments(tenant_id,order_id,reference_number);
CREATE TABLE refund_records (
 tenant_id text NOT NULL,id text NOT NULL,order_id text NOT NULL,payment_id text,source_settlement_id text,
 amount bigint NOT NULL CHECK(amount>0),refund_date date NOT NULL,reason text NOT NULL CHECK(length(trim(reason))>0),evidence_reference text NOT NULL,
 created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),FOREIGN KEY(tenant_id,payment_id) REFERENCES payments(tenant_id,id),
 FOREIGN KEY(tenant_id,source_settlement_id) REFERENCES settlements(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES app_users(tenant_id,id)
);
CREATE TRIGGER refunds_immutable BEFORE UPDATE OR DELETE ON refund_records FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();
CREATE UNIQUE INDEX refund_evidence_unique ON refund_records(tenant_id,source_settlement_id,order_id,evidence_reference);
CREATE TRIGGER approved_expense_immutable BEFORE UPDATE OR DELETE ON pool_expenses FOR EACH ROW EXECUTE FUNCTION protect_approved_version();
CREATE TRIGGER finalized_order_immutable BEFORE UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();
CREATE TRIGGER finalized_item_immutable BEFORE UPDATE OR DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();
CREATE TRIGGER target_version_immutable BEFORE UPDATE OR DELETE ON employee_targets FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();
CREATE UNIQUE INDEX whole_settlement_payout_unique ON settlement_payouts(tenant_id,settlement_id);
CREATE FUNCTION protect_period_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.configuration_snapshot IS DISTINCT FROM OLD.configuration_snapshot OR NEW.starts_on IS DISTINCT FROM OLD.starts_on OR NEW.ends_on IS DISTINCT FROM OLD.ends_on OR NEW.business_timezone IS DISTINCT FROM OLD.business_timezone THEN RAISE EXCEPTION 'PERIOD_CONFIGURATION_SNAPSHOT_IMMUTABLE'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER period_configuration_immutable BEFORE UPDATE ON calculation_periods FOR EACH ROW EXECUTE FUNCTION protect_period_configuration();
INSERT INTO schema_migrations(version) VALUES ('002_local_application');
COMMIT;
