# Canonical domain model — proposed schema contract

All financially relevant rows carry internal IDs, tenant isolation, timestamps and actor provenance. Money carries currency plus exact minor-unit integer; decimal quantities/rates retain exact precision. IDs in the canonical model are strings independent of source integer encoding.

| Entity | Essential fields and relationships |
|---|---|
| Employee | id, employee_code, name, active, user_id; external owner mappings kept separately |
| Customer | id, name, active, external mapping |
| Product | id, external mapping, JAN/source identifier, SKU, name, product_group_id, active; versioned list prices |
| ProductPriceVersion | product_id, version, exact price, input VAT basis, currency/pack, source VAT/version, effective_from/to, status, source hash/page/row and change reason |
| PriceSnapshot | order_item_id, price_version_id, exact price/currency/pack, VAT and revenue-basis version, effective context, provenance |
| RevenueCalculationPolicy | version, EXCLUDING_VAT default or approved configured basis, effective dates, creator/approval |
| SupportDistributionPolicy | version, FIXED_PERCENT MKT 60% / Accounting 20% / Logistics 20%, effective context, departmental references |
| Order | id, customer_id, PM employee_id, external mapping, number, order_date, currency, source_status, revision_id, finalization state |
| OrderItem | id, order_id, product_id, stable external mapping, exact quantity, versioned reference/list price snapshot and VAT/basis snapshot, selling unit price, gross, discount, net, tax context, policy snapshot, source revision |
| Payment | id, order_id, amount, currency, payment_date, method, reference, note, evidence, DRAFT/CONFIRMED/REVERSED, created_by, confirmed_by, confirmed_at, reversal linkage |
| PaymentAllocation | payment_id, order_item_id, amount, allocation_method, override_reason, actor; sum equals payment amount |
| ManagementPoolPolicy | id, version, scope ALL/PRODUCT_GROUP/PRODUCT, scope_ref, exact rate, effective_from/to, DRAFT/APPROVED/RETIRED, created_by, approved_by |
| BonusPolicy | id, version, effective_from/to, PM/Support/Company exact shares, target gate, support_strategy, approval provenance |
| PoolExpense | id, order_id, optional item_id, category, amount, source, evidence/reference, creator, approval state/actor, timestamps |
| EmployeeTarget | employee_id, period_id, COLLECTED_REVENUE, currency, amount, version, approval provenance |
| CalculationPeriod | id, start/end, business_timezone, OPEN/REVIEW/LOCKED/PAID, revision, locked_by/at |
| BonusCalculation | id, period_id, employee_id, engine_version, input_hash, calculated/earned/payable totals, snapshot_ref, run status |
| BonusCalculationLine | calculation_id, item_id, allocation/event references, gross/discount/net/pool/expenses/residual, shares, collected portion, target result, explanation |
| Settlement | id, period_id, recipient/pool, calculated/earned/payable totals, immutable snapshot, hash, locked_by/at, paid_by/at, payout evidence |
| Adjustment | source_period_id, application_period_id, amount, currency, beneficiary/bucket, original_paid_settlement_id, refund_event_id, recovery linkage, reason, related_entity, created_by, approved_by, approval state, timestamps |
| AuditLog | actor, time, action, entity/type/id, redacted before/after, reason, correlation/request_id; append-only |
| ExternalEntityMapping | tenant, source, entity_type, external_id, internal_id, mapping_version, source_revision, last_sync_at |

Additional explicit supporting tables: ProductGroup, OrderRevision/OrderItemRevision, PolicySnapshot, FieldMappingVersion, SyncInbox, SyncRun/Cursor, Outbox, ReconciliationIssue, SupportAllocation and immutable financial-event ledger. These support auditability rather than a generic catch-all finance table.

## Constraints

- Policy scope references must match scope; effective intervals proposed as `[from,to)`. Same-scope approved intervals cannot overlap; ambiguity is an error, not latest-row-wins.
- Precedence PRODUCT > PRODUCT_GROUP > ALL at order date. Missing policy rejects finalization. Product group at effective context is snapshotted.
- Each policy/snapshot version is immutable after financial use; new changes create versions. Retiring a version does not delete references.
- Bonus shares sum exactly to one; percentage parsing is exact. Sample percentages are fixture input only.
- Same-order/currency allocation references; payment sum must exactly equal allocations. No silent over-collection, currency conversion, negative input or zero denominator.
- Discount has one canonical authoritative pricing representation. CUSTOMER_DISCOUNT expense imports are provenance/reference only when pricing already contains that deduction; duplicates are rejected from deductible expenses.
- Payment confirmations and reversal links are unique/idempotent; prior confirmation fact remains in the ledger. No deletion of economic facts.
- All foreign keys affecting locked settlements are restricted; ordinary roles cannot update snapshot payloads or audit logs.
- Period transition constraints apply server-side and in transaction; optimistic version checks prevent stale approval.
- VND final bonus rounding is upward to 1,000 with separate delta; cash uses exact minor units. Revenue defaults before VAT, adjustable by version. Negative residual keeps raw deficit but PM/Support bonuses zero with reason. Net/AMIS VAT allocation and pool list-base VAT context remain pending.
