BEGIN;
CREATE TABLE schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE tenants (id text PRIMARY KEY, name text NOT NULL);
CREATE TABLE app_users (
  tenant_id text NOT NULL REFERENCES tenants(id), id text NOT NULL, name text NOT NULL,
  role text NOT NULL CHECK (role IN ('ADMIN','ACCOUNTING','PM','SALES_MANAGER','SUPPORT_MANAGER','EXECUTIVE','AUDITOR')),
  active boolean NOT NULL DEFAULT true, PRIMARY KEY (tenant_id,id)
);
CREATE TABLE employees (
  tenant_id text NOT NULL REFERENCES tenants(id), id text NOT NULL, code text NOT NULL, name text NOT NULL,
  user_id text, active boolean NOT NULL DEFAULT true, PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,code),
  FOREIGN KEY(tenant_id,user_id) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE customers (tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,name text NOT NULL,active boolean NOT NULL DEFAULT true,PRIMARY KEY(tenant_id,id));
CREATE TABLE product_groups (tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,name text NOT NULL,PRIMARY KEY(tenant_id,id));
CREATE TABLE products (
  tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,sku text NOT NULL,name text NOT NULL,jan_source text,
  product_group_id text,active boolean NOT NULL DEFAULT true,PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,sku),
  FOREIGN KEY(tenant_id,product_group_id) REFERENCES product_groups(tenant_id,id)
);
CREATE TABLE management_pool_policies (
  tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,version integer NOT NULL CHECK(version>0),
  scope text NOT NULL CHECK(scope IN ('ALL','PRODUCT_GROUP','PRODUCT')),product_id text,product_group_id text,
  pool_rate numeric NOT NULL CHECK(pool_rate BETWEEN 0 AND 1),effective_from date NOT NULL,effective_to date,
  status text NOT NULL CHECK(status IN ('DRAFT','APPROVED','RETIRED')),created_by text NOT NULL,approved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,id,version),
  CHECK(effective_to IS NULL OR effective_to>effective_from),
  CHECK((scope='ALL' AND product_id IS NULL AND product_group_id IS NULL) OR (scope='PRODUCT' AND product_id IS NOT NULL AND product_group_id IS NULL) OR (scope='PRODUCT_GROUP' AND product_id IS NULL AND product_group_id IS NOT NULL)),
  CHECK(status<>'APPROVED' OR approved_by IS NOT NULL),
  FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id),FOREIGN KEY(tenant_id,product_group_id) REFERENCES product_groups(tenant_id,id),
  FOREIGN KEY(tenant_id,created_by) REFERENCES app_users(tenant_id,id),FOREIGN KEY(tenant_id,approved_by) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE product_price_versions (
  tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,product_id text NOT NULL,version integer NOT NULL CHECK(version>0),
  input_amount numeric NOT NULL CHECK(input_amount>=0),currency text NOT NULL CHECK(currency='VND'),pack text NOT NULL,
  tax_basis text NOT NULL CHECK(tax_basis IN ('INCLUDING_VAT','EXCLUDING_VAT')),vat_rate numeric NOT NULL CHECK(vat_rate BETWEEN 0 AND 1),
  effective_from date,effective_to date,status text NOT NULL CHECK(status IN ('PROVISIONAL','DRAFT','APPROVED','RETIRED')),
  source_reference text NOT NULL,source_hash text,change_reason text NOT NULL,created_by text NOT NULL,approved_by text,
  PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,product_id,version),UNIQUE(tenant_id,product_id,id),CHECK(effective_to IS NULL OR effective_to>effective_from),
  CHECK(status<>'APPROVED' OR (effective_from IS NOT NULL AND approved_by IS NOT NULL)),
  FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES app_users(tenant_id,id),FOREIGN KEY(tenant_id,approved_by) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE bonus_policies (
  tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,version integer NOT NULL CHECK(version>0),
  pm_share numeric NOT NULL CHECK(pm_share BETWEEN 0 AND 1),support_share numeric NOT NULL CHECK(support_share BETWEEN 0 AND 1),company_share numeric NOT NULL CHECK(company_share BETWEEN 0 AND 1),
  effective_from date NOT NULL,effective_to date,status text NOT NULL CHECK(status IN ('DRAFT','APPROVED','RETIRED')),
  rounding_mode text NOT NULL CHECK(rounding_mode='CEILING'),rounding_quantum bigint NOT NULL CHECK(rounding_quantum>0),
  created_by text NOT NULL,approved_by text,PRIMARY KEY(tenant_id,id),CHECK(pm_share+support_share+company_share=1),
  CHECK(effective_to IS NULL OR effective_to>effective_from),CHECK(status<>'APPROVED' OR approved_by IS NOT NULL),
  FOREIGN KEY(tenant_id,created_by) REFERENCES app_users(tenant_id,id),FOREIGN KEY(tenant_id,approved_by) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE support_distribution_policies (
  tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,version integer NOT NULL CHECK(version>0),
  strategy text NOT NULL CHECK(strategy IN ('EQUAL','FIXED_PERCENT','WEIGHTED','MANUAL')),
  mkt_share numeric,accounting_share numeric,logistics_share numeric,effective_from date NOT NULL,effective_to date,
  created_by text NOT NULL,approved_by text,PRIMARY KEY(tenant_id,id),
  CHECK(strategy<>'FIXED_PERCENT' OR (mkt_share IS NOT NULL AND accounting_share IS NOT NULL AND logistics_share IS NOT NULL AND mkt_share>=0 AND accounting_share>=0 AND logistics_share>=0 AND mkt_share+accounting_share+logistics_share=1)),
  CHECK(effective_to IS NULL OR effective_to>effective_from),
  FOREIGN KEY(tenant_id,created_by) REFERENCES app_users(tenant_id,id),FOREIGN KEY(tenant_id,approved_by) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE revenue_basis_policies (
  tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,version integer NOT NULL CHECK(version>0),
  basis text NOT NULL CHECK(basis IN ('INCLUDING_VAT','EXCLUDING_VAT')),effective_from date NOT NULL,effective_to date,
  created_by text NOT NULL,approved_by text,PRIMARY KEY(tenant_id,id),CHECK(effective_to IS NULL OR effective_to>effective_from),
  FOREIGN KEY(tenant_id,created_by) REFERENCES app_users(tenant_id,id),FOREIGN KEY(tenant_id,approved_by) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE orders (
  tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,order_number text NOT NULL,customer_id text NOT NULL,pm_id text,
  order_date date NOT NULL,currency text NOT NULL CHECK(currency='VND'),source_status text NOT NULL,source_revision text NOT NULL,
  PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id),FOREIGN KEY(tenant_id,pm_id) REFERENCES employees(tenant_id,id)
);
CREATE TABLE order_items (
  tenant_id text NOT NULL,id text NOT NULL,order_id text NOT NULL,product_id text NOT NULL,quantity numeric NOT NULL CHECK(quantity>=0),
  gross_list_value numeric NOT NULL CHECK(gross_list_value>=0),discount_amount numeric NOT NULL CHECK(discount_amount>=0),net_sales_value numeric NOT NULL CHECK(net_sales_value>=0),
  price_version_id text NOT NULL,pool_policy_id text NOT NULL,pool_policy_version integer NOT NULL CHECK(pool_policy_version>0),pool_rate_snapshot numeric NOT NULL CHECK(pool_rate_snapshot BETWEEN 0 AND 1),
  price_snapshot jsonb NOT NULL CHECK(jsonb_typeof(price_snapshot)='object'),effective_context jsonb NOT NULL CHECK(jsonb_typeof(effective_context)='object'),
  PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,order_id,id),
  FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id),
  FOREIGN KEY(tenant_id,product_id,price_version_id) REFERENCES product_price_versions(tenant_id,product_id,id),FOREIGN KEY(tenant_id,pool_policy_id,pool_policy_version) REFERENCES management_pool_policies(tenant_id,id,version)
);
CREATE TABLE calculation_periods (
  tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,starts_on date NOT NULL,ends_on date NOT NULL,business_timezone text NOT NULL,
  state text NOT NULL CHECK(state IN ('OPEN','REVIEW','LOCKED','PAID')),revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  locked_by text,locked_at timestamptz,PRIMARY KEY(tenant_id,id),CHECK(ends_on>starts_on),
  CHECK(state NOT IN ('LOCKED','PAID') OR (locked_by IS NOT NULL AND locked_at IS NOT NULL)),FOREIGN KEY(tenant_id,locked_by) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE payments (
  tenant_id text NOT NULL,id text NOT NULL,order_id text NOT NULL,amount bigint NOT NULL CHECK(amount>0),currency text NOT NULL CHECK(currency='VND'),
  payment_date date NOT NULL,method text NOT NULL,reference_number text NOT NULL,note text NOT NULL DEFAULT '',evidence_reference text,
  status text NOT NULL CHECK(status IN ('DRAFT','CONFIRMED','REVERSED')),created_by text NOT NULL,confirmed_by text,confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,order_id,id),
  CHECK(status='DRAFT' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)),
  FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES app_users(tenant_id,id),FOREIGN KEY(tenant_id,confirmed_by) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE payment_allocations (
  tenant_id text NOT NULL,order_id text NOT NULL,payment_id text NOT NULL,order_item_id text NOT NULL,amount bigint NOT NULL CHECK(amount>=0),
  allocation_method text NOT NULL CHECK(allocation_method IN ('PRO_RATA_BY_NET_VALUE','MANUAL')),override_reason text,
  PRIMARY KEY(tenant_id,payment_id,order_item_id),CHECK(allocation_method<>'MANUAL' OR (override_reason IS NOT NULL AND length(trim(override_reason))>0)),
  FOREIGN KEY(tenant_id,order_id,payment_id) REFERENCES payments(tenant_id,order_id,id),FOREIGN KEY(tenant_id,order_id,order_item_id) REFERENCES order_items(tenant_id,order_id,id)
);
CREATE TABLE pool_expenses (
  tenant_id text NOT NULL,id text NOT NULL,order_id text NOT NULL,order_item_id text,category text NOT NULL CHECK(category IN ('CUSTOMER_DISCOUNT','MARKETING_SUPPORT','DEALER_INCENTIVE','SALES_INCENTIVE','OTHER','RESERVE')),
  amount numeric NOT NULL CHECK(amount>=0),source text NOT NULL,evidence_reference text,status text NOT NULL CHECK(status IN ('DRAFT','PENDING','APPROVED','REJECTED')),
  deductible boolean NOT NULL,created_by text NOT NULL,approved_by text,approved_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id),CHECK(category<>'CUSTOMER_DISCOUNT' OR deductible=false),CHECK(status<>'APPROVED' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),FOREIGN KEY(tenant_id,order_id,order_item_id) REFERENCES order_items(tenant_id,order_id,id),
  FOREIGN KEY(tenant_id,created_by) REFERENCES app_users(tenant_id,id),FOREIGN KEY(tenant_id,approved_by) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE employee_targets (
  tenant_id text NOT NULL,id text NOT NULL,employee_id text NOT NULL,period_id text NOT NULL,type text NOT NULL CHECK(type='COLLECTED_REVENUE'),
  amount numeric NOT NULL CHECK(amount>0),currency text NOT NULL CHECK(currency='VND'),version integer NOT NULL CHECK(version>0),
  created_by text NOT NULL,PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,employee_id,period_id,version),FOREIGN KEY(tenant_id,employee_id) REFERENCES employees(tenant_id,id),
  FOREIGN KEY(tenant_id,period_id) REFERENCES calculation_periods(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE bonus_calculations (
  tenant_id text NOT NULL,id text NOT NULL,period_id text NOT NULL,employee_id text NOT NULL,engine_version text NOT NULL,input_hash text NOT NULL,
  calculated_exact text NOT NULL,earned_exact text NOT NULL,payable_exact text,rounding_delta_exact text,trace jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,period_id,id),
  FOREIGN KEY(tenant_id,period_id) REFERENCES calculation_periods(tenant_id,id),FOREIGN KEY(tenant_id,employee_id) REFERENCES employees(tenant_id,id)
);
CREATE TABLE bonus_calculation_lines (
  tenant_id text NOT NULL,id text NOT NULL,period_id text NOT NULL,calculation_id text NOT NULL,order_item_id text NOT NULL,trace jsonb NOT NULL,
  PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,period_id,calculation_id) REFERENCES bonus_calculations(tenant_id,period_id,id),FOREIGN KEY(tenant_id,order_item_id) REFERENCES order_items(tenant_id,id)
);
CREATE TABLE settlements (
  tenant_id text NOT NULL,id text NOT NULL,period_id text NOT NULL,recipient_type text NOT NULL CHECK(recipient_type IN ('EMPLOYEE','DEPARTMENT','COMPANY')),recipient_id text NOT NULL,
  immutable_snapshot jsonb NOT NULL CHECK(jsonb_typeof(immutable_snapshot)='object'),snapshot_hash text NOT NULL,
  locked_by text NOT NULL,locked_at timestamptz NOT NULL,PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,period_id,recipient_type,recipient_id),
  FOREIGN KEY(tenant_id,period_id) REFERENCES calculation_periods(tenant_id,id),FOREIGN KEY(tenant_id,locked_by) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE settlement_payouts (
  tenant_id text NOT NULL,id text NOT NULL,settlement_id text NOT NULL,amount bigint NOT NULL CHECK(amount>0),paid_by text NOT NULL,paid_at timestamptz NOT NULL,evidence_reference text NOT NULL,
  PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,settlement_id) REFERENCES settlements(tenant_id,id),FOREIGN KEY(tenant_id,paid_by) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE adjustments (
  tenant_id text NOT NULL,id text NOT NULL,source_period_id text NOT NULL,application_period_id text NOT NULL,source_settlement_id text,
  amount bigint NOT NULL,currency text NOT NULL CHECK(currency='VND'),reason text NOT NULL CHECK(length(trim(reason))>0),related_entity text NOT NULL,
  status text NOT NULL CHECK(status IN ('DRAFT','PENDING','APPROVED','REJECTED')),created_by text NOT NULL,approved_by text,approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),CHECK(source_period_id<>application_period_id),CHECK(status<>'APPROVED' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  FOREIGN KEY(tenant_id,source_period_id) REFERENCES calculation_periods(tenant_id,id),FOREIGN KEY(tenant_id,application_period_id) REFERENCES calculation_periods(tenant_id,id),
  FOREIGN KEY(tenant_id,source_settlement_id) REFERENCES settlements(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES app_users(tenant_id,id),FOREIGN KEY(tenant_id,approved_by) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE adjustment_applications (
  tenant_id text NOT NULL,adjustment_id text NOT NULL,settlement_id text NOT NULL,applied_at timestamptz NOT NULL,
  PRIMARY KEY(tenant_id,adjustment_id),FOREIGN KEY(tenant_id,adjustment_id) REFERENCES adjustments(tenant_id,id),FOREIGN KEY(tenant_id,settlement_id) REFERENCES settlements(tenant_id,id)
);
CREATE TABLE audit_logs (
  tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,actor_id text NOT NULL,occurred_at timestamptz NOT NULL,action text NOT NULL,entity_type text NOT NULL,entity_id text NOT NULL,
  before_state jsonb,after_state jsonb,reason text,request_id text NOT NULL,PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,actor_id) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE field_mapping_versions (
  tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,version integer NOT NULL CHECK(version>0),endpoint text NOT NULL,json_path text NOT NULL,canonical_field text NOT NULL,
  datatype text NOT NULL,nullable boolean NOT NULL,transformation text NOT NULL,direction text NOT NULL CHECK(direction='INBOUND'),evidence_reference text NOT NULL,
  approved_by text NOT NULL,PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,approved_by) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE external_entity_mappings (
  tenant_id text NOT NULL REFERENCES tenants(id),source_system text NOT NULL,entity_type text NOT NULL,external_entity_id text NOT NULL,internal_entity_id text NOT NULL,
  mapping_version_id text NOT NULL,source_revision text NOT NULL,last_sync_at timestamptz NOT NULL,PRIMARY KEY(tenant_id,source_system,entity_type,external_entity_id),
  FOREIGN KEY(tenant_id,mapping_version_id) REFERENCES field_mapping_versions(tenant_id,id)
);
CREATE TABLE financial_events (
  tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,event_type text NOT NULL,entity_id text NOT NULL,immutable_payload jsonb NOT NULL,actor_id text NOT NULL,occurred_at timestamptz NOT NULL,idempotency_key text NOT NULL,
  PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,idempotency_key),FOREIGN KEY(tenant_id,actor_id) REFERENCES app_users(tenant_id,id)
);
CREATE TABLE sync_inbox (
  tenant_id text NOT NULL REFERENCES tenants(id),source_system text NOT NULL,event_key text NOT NULL,payload jsonb NOT NULL,received_at timestamptz NOT NULL,status text NOT NULL CHECK(status IN ('PENDING','PROCESSED','QUARANTINED')),
  PRIMARY KEY(tenant_id,source_system,event_key)
);
CREATE TABLE sync_cursors (tenant_id text NOT NULL REFERENCES tenants(id),entity_type text NOT NULL,cursor jsonb NOT NULL,updated_at timestamptz NOT NULL,PRIMARY KEY(tenant_id,entity_type));
CREATE TABLE reconciliation_issues (tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,entity_type text NOT NULL,entity_id text NOT NULL,reason text NOT NULL,evidence jsonb NOT NULL,resolved_by text,PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,resolved_by) REFERENCES app_users(tenant_id,id));
CREATE TABLE outbox (tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,topic text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),delivered_at timestamptz,PRIMARY KEY(tenant_id,id));

CREATE FUNCTION reject_immutable_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_FINANCIAL_RECORD: %',TG_TABLE_NAME; END; $$;
CREATE TRIGGER settlements_immutable BEFORE UPDATE OR DELETE ON settlements FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();
CREATE TRIGGER financial_events_immutable BEFORE UPDATE OR DELETE ON financial_events FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();
CREATE TRIGGER payout_immutable BEFORE UPDATE OR DELETE ON settlement_payouts FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();
CREATE TRIGGER application_immutable BEFORE UPDATE OR DELETE ON adjustment_applications FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();

CREATE FUNCTION protect_approved_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF OLD.status='APPROVED' THEN RAISE EXCEPTION 'APPROVED_VERSION_IS_IMMUTABLE'; END IF; IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END; $$;
CREATE TRIGGER pool_version_guard BEFORE UPDATE OR DELETE ON management_pool_policies FOR EACH ROW EXECUTE FUNCTION protect_approved_version();
CREATE TRIGGER price_version_guard BEFORE UPDATE OR DELETE ON product_price_versions FOR EACH ROW EXECUTE FUNCTION protect_approved_version();
CREATE TRIGGER bonus_version_guard BEFORE UPDATE OR DELETE ON bonus_policies FOR EACH ROW EXECUTE FUNCTION protect_approved_version();
CREATE TRIGGER approved_adjustment_guard BEFORE UPDATE OR DELETE ON adjustments FOR EACH ROW EXECUTE FUNCTION protect_approved_version();

CREATE FUNCTION protect_period_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state IN ('LOCKED','PAID') AND (TG_OP='DELETE' OR NEW.starts_on IS DISTINCT FROM OLD.starts_on OR NEW.ends_on IS DISTINCT FROM OLD.ends_on OR NEW.business_timezone IS DISTINCT FROM OLD.business_timezone OR NEW.locked_by IS DISTINCT FROM OLD.locked_by OR NEW.locked_at IS DISTINCT FROM OLD.locked_at) THEN RAISE EXCEPTION 'LOCKED_PERIOD_IS_IMMUTABLE'; END IF;
  IF TG_OP='DELETE' THEN IF OLD.state IN ('LOCKED','PAID') THEN RAISE EXCEPTION 'LOCKED_PERIOD_IS_IMMUTABLE'; END IF; RETURN OLD; END IF;
  IF NEW.state<>OLD.state AND NOT ((OLD.state='OPEN' AND NEW.state='REVIEW') OR (OLD.state='REVIEW' AND NEW.state='LOCKED') OR (OLD.state='LOCKED' AND NEW.state='PAID')) THEN RAISE EXCEPTION 'INVALID_PERIOD_TRANSITION'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER period_state_guard BEFORE UPDATE OR DELETE ON calculation_periods FOR EACH ROW EXECUTE FUNCTION protect_period_state();
CREATE FUNCTION require_writable_period() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p text; t text; locked boolean;
BEGIN
  IF TG_OP<>'INSERT' THEN
    SELECT state IN ('LOCKED','PAID') INTO locked FROM calculation_periods WHERE tenant_id=OLD.tenant_id AND id=OLD.period_id FOR SHARE;
    IF locked THEN RAISE EXCEPTION 'LOCKED_PERIOD_HISTORY'; END IF;
  END IF;
  IF TG_OP<>'DELETE' THEN
    SELECT state IN ('LOCKED','PAID') INTO locked FROM calculation_periods WHERE tenant_id=NEW.tenant_id AND id=NEW.period_id FOR SHARE;
    IF locked THEN RAISE EXCEPTION 'LOCKED_PERIOD_HISTORY'; END IF; RETURN NEW;
  END IF;
  RETURN OLD;
END; $$;
CREATE TRIGGER calculation_period_guard BEFORE INSERT OR UPDATE OR DELETE ON bonus_calculations FOR EACH ROW EXECUTE FUNCTION require_writable_period();
CREATE TRIGGER calculation_line_period_guard BEFORE INSERT OR UPDATE OR DELETE ON bonus_calculation_lines FOR EACH ROW EXECUTE FUNCTION require_writable_period();
CREATE TRIGGER target_period_guard BEFORE INSERT OR UPDATE OR DELETE ON employee_targets FOR EACH ROW EXECUTE FUNCTION require_writable_period();

CREATE FUNCTION protect_confirmed_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('CONFIRMED','REVERSED') THEN RAISE EXCEPTION 'CONFIRMED_PAYMENT_IS_IMMUTABLE_USE_FINANCIAL_EVENT'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER confirmed_payment_guard BEFORE UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION protect_confirmed_payment();
CREATE FUNCTION protect_confirmed_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original_status text; destination_status text;
BEGIN
  IF TG_OP<>'INSERT' THEN
    SELECT status INTO original_status FROM payments WHERE tenant_id=OLD.tenant_id AND id=OLD.payment_id FOR UPDATE;
    IF original_status IN ('CONFIRMED','REVERSED') THEN RAISE EXCEPTION 'CONFIRMED_ALLOCATION_IS_IMMUTABLE'; END IF;
  END IF;
  IF TG_OP<>'DELETE' THEN
    SELECT status INTO destination_status FROM payments WHERE tenant_id=NEW.tenant_id AND id=NEW.payment_id FOR UPDATE;
    IF destination_status IN ('CONFIRMED','REVERSED') THEN RAISE EXCEPTION 'CONFIRMED_ALLOCATION_IS_IMMUTABLE'; END IF; RETURN NEW;
  END IF;
  RETURN OLD;
END; $$;
CREATE TRIGGER confirmed_allocation_guard BEFORE INSERT OR UPDATE OR DELETE ON payment_allocations FOR EACH ROW EXECUTE FUNCTION protect_confirmed_allocation();

CREATE FUNCTION validate_payment_allocation_sum() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p_id text; t_id text; expected bigint; actual numeric; payment_status text;
BEGIN
  IF TG_TABLE_NAME='payments' THEN p_id=NEW.id;t_id=NEW.tenant_id;
  ELSE IF TG_OP='DELETE' THEN p_id=OLD.payment_id;t_id=OLD.tenant_id; ELSE p_id=NEW.payment_id;t_id=NEW.tenant_id; END IF; END IF;
  SELECT amount,status INTO expected,payment_status FROM payments WHERE tenant_id=t_id AND id=p_id FOR UPDATE;
  IF payment_status IN ('CONFIRMED','REVERSED') THEN
    SELECT COALESCE(sum(amount),0) INTO actual FROM payment_allocations WHERE tenant_id=t_id AND payment_id=p_id;
    IF actual<>expected THEN RAISE EXCEPTION 'PAYMENT_ALLOCATION_SUM_MISMATCH'; END IF;
  END IF;
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER payment_conservation AFTER INSERT OR UPDATE ON payments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_payment_allocation_sum();
CREATE CONSTRAINT TRIGGER allocation_conservation AFTER INSERT OR UPDATE OR DELETE ON payment_allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_payment_allocation_sum();

CREATE FUNCTION validate_financial_approver() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE approver_role text; approver_active boolean;
BEGIN
  IF NEW.status='APPROVED' THEN
    SELECT role,active INTO approver_role,approver_active FROM app_users WHERE tenant_id=NEW.tenant_id AND id=NEW.approved_by;
    IF approver_role IS NULL OR approver_role NOT IN ('ADMIN','EXECUTIVE') OR NOT approver_active THEN RAISE EXCEPTION 'DIRECTOR_OR_ADMIN_APPROVAL_REQUIRED'; END IF;
  END IF; RETURN NEW;
END; $$;
CREATE TRIGGER expense_approver_guard BEFORE INSERT OR UPDATE ON pool_expenses FOR EACH ROW EXECUTE FUNCTION validate_financial_approver();
CREATE TRIGGER adjustment_approver_guard BEFORE INSERT OR UPDATE ON adjustments FOR EACH ROW EXECUTE FUNCTION validate_financial_approver();
INSERT INTO schema_migrations(version) VALUES ('001_domain_foundation');
COMMIT;
