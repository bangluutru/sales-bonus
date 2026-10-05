# Architecture — Phase 0 design proposal

## Boundary and ownership

AMIS CRM remains the operational system for customers, products, orders, item pricing/discounts, and owners. Commission owns employee mappings, confirmed payment transactions/allocations, policies, eligible expenses, targets, calculation periods, calculations, settlements, adjustments, and audit records. AMIS collection summary fields are reconciliation references, not confirmed payment evidence.

Proposed stack: TypeScript modular monolith, PostgreSQL transactional storage, React UI, server API and durable background worker. Hosting and identity provider remain undecided. These choices are proposals, not existing infrastructure.

## Modules

`AmisClient -> AmisAdapter -> Canonical command -> Application service -> Domain -> Repository`

The client handles HTTP/authentication/retry. The adapter validates payloads and approved mapping versions, preserves provenance, and rejects missing financial inputs. Domain functions accept immutable canonical data; no AMIS paths, HTTP, database queries, UI, clock reads, or randomness are allowed inside calculations.

Proposed layout: `apps/web`, `apps/api`, `apps/worker`, `packages/domain`, `packages/amis`, `packages/persistence`. Implement only after gates close.

## Synchronization

Both authenticated webhook intake and scheduled reconciliation enqueue the same canonical sync command. Persist webhook inbox before acknowledging; recover worker failures. Event IDs/signatures/delivery semantics are not yet documented: no invented signature protocol. If authenticity cannot be verified, treat callbacks only as hints and fetch source data with server credentials before applying changes. Rate-limit ingress.

Unique mapping: `(tenant_id, source_system, entity_type, external_entity_id)` prevents collisions across entity types and tenants. Unique event key where available; canonical revision hash for duplicate payloads. Parent/item/mapping/audit changes commit atomically. Serialize competing updates per entity; do not assume source timestamps define a total ordering. Stale/conflicting events trigger authoritative refetch or quarantine.

Use paginated scheduled reads, persistent resumable cursors, an overlap window, replay and periodic full reconciliation. API documentation lists sorting, not an incremental modified-since filter: do not invent one. Advance cursor only after committed pages. Detect deletions/cancellations without destructive removal of financial references. Transactional outbox handles downstream jobs.

Item external identifiers are a discovery gap. Array index, mutable SKU, and sort order are insufficient as durable identities. Block settlement eligibility until identity mapping is resolved.

## Financial transactions and immutable history

Payment confirmation locks the order and validates allocations, amount, currency, evidence, permissions and period state. Confirmation/allocation/audit writes share one transaction and request idempotency key. Retrying a confirmation cannot earn twice.

Locking serializes against sync/payment/expense/target writes for the period, validates all reconciliations, builds immutable settlement rows and complete input snapshots, and commits status plus audit atomically. Snapshot includes source revision, mapping version, policy versions, engine version, rounding rule, currency, allocations, expense evidence, target and approved adjustments. Hash snapshots for tamper detection; hash alone is not immutability or trusted timestamping.

Subsequent source changes preserve locked versions and create review issues. Cross-period corrections use approved adjustments; refund/reversal rules await business decisions. Use database restrictions for locked facts, not UI-only controls.

## UI and proposed internal API

Navigation: Tổng quan; Đơn hàng; Đối soát thu tiền; Tính thưởng; Báo cáo; Nhân sự; Chính sách thưởng; Kết nối AMIS CRM; Hệ thống.

Accounting flow: find order -> see net/confirmed/outstanding and source revision -> draft payment/evidence -> review allocations -> confirm -> see trace and audit. Authorized manual allocation requires reason.

Internal routes (proposed, not AMIS endpoints): `GET /orders`, `POST /orders/:id/payments`, `POST /payments/:id/confirm`, `POST /payments/:id/reverse`, `POST /periods/:id/review`, `POST /periods/:id/lock`, `POST /settlements/:id/paid`, `GET /calculations/:id/explanation`, `POST /adjustments`.

Dashboard period filter must show sales, confirmed collections, collection rate, outstanding, calculated PM, earned PM, payable PM, Support Pool, company share. Label cohort sales versus period cash clearly so old-order collections do not distort a rate. Denominator and reporting cohorts require decision B10. “Xem cách tính” reads the stored calculation trace used to generate totals. Approved visual reference is missing.

## Operations

Encrypted backups, restore drills, forward-reviewed migrations, structured redacted logs, sync health/cursors, quarantined mappings, retry queue/dead-letter alerts, snapshot reconciliation, and no silent repairs to locked history. Deployment remains blocked until all production readiness gates pass.

## Approved design update — 2026-10-05

See [product pricing](product-pricing.md) and [calculation specification](calculation-spec.md): versioned product list prices and VAT/revenue basis; provisional 46-product quote import; negative residual keeps loss trace but zero employee incentives; Director/Admin expense and adjustment approval; temporary Support departments 60/20/20; final bonuses round upward to 1,000 VND with separate delta; post-lock refund creates warning and approved clawback referencing already-paid bonus. These direct decisions supersede earlier proposals, but unresolved source/recognition details remain gated.

## Local application checkpoint — 2026-10-06

The independent manual-entry application is implemented and tested. Current behavior, role boundaries, configuration choices, validation evidence and external gates are recorded in [README](../README.md), [self-review](self-review.md) and [production readiness](../PRODUCTION_READINESS.md). Earlier architecture/phase proposals do not imply that AMIS or historical sources have been verified. Local configuration explicitly selects VAT basis, recognition/expense timing and order-date snapshots; no example policy rates are activated silently.
