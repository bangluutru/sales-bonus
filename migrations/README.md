# Database foundation

`001_domain_foundation.sql` is a transactional PostgreSQL migration for a **clean database**. Apply with a reviewed migration runner or `psql -v ON_ERROR_STOP=1 -f migrations/001_domain_foundation.sql`; connection secrets stay outside the repository. No live database has been created or migrated.

Automated migration tests use PGlite (PostgreSQL WASM) and real PostgreSQL SQL/constraints/triggers in isolated in-memory databases. This validates fresh-schema behavior; it is not a production-host backup/restore, concurrent multi-connection locking or upgrade test.

Tenant-scoped foreign keys keep entity associations within one tenant. Database constraints check exact share sums, same-order payment allocations, single-use adjustment application and Director/Admin expense/adjustment approvals. Confirmed payment facts and allocations cannot be edited: Phase 4 must append reversal events with audit instead. A canonical REVERSED status is derived from economic events, not obtained by updating a confirmed transaction in place.

Approved policy/price versions, locked calculation rows, settlements, payouts, adjustment applications, financial events and audit rows are protected against ordinary edits. A future application service still needs to enforce authentication, scoped server RBAC, approval state, policy interval conflicts, complete period reconciliation, snapshot/hash generation and transactional audit writes. Payouts are separate rows so immutable settlement snapshots are not updated to mark payment. RLS, restricted database roles, backup/migration review and concurrency validation remain required before production.

No production policy/price seed is activated: unresolved source/effective-date choices remain explicit. `data/reference/approved-rule-directions.json` records approved user directions, not a complete deployable financial policy.
