# Ordered implementation gates

| Phase | Output / gate | Current state |
|---|---|---|
| 0 Discovery | Seven required docs, workbook inventory, tenant API spike, financial decision register resolved | Docs updated for user decisions; provisional 46-product prices extracted; workbook/tenant and remaining rules pending |
| 1 Domain foundation | Reviewed schema/migrations, canonical entities, exact-money engine; unit tests first, critical domain cases pass; checkpoint commit | Foundation implemented: 19 domain tests + 5 PostgreSQL migration tests pass; complete policy/application lifecycle remains under source and rule gates |
| 2 Historical validation | Source workbook extraction, anomaly approval, normalized approved Golden Dataset, exact regression; checkpoint | Blocked by workbook/approval |
| 3 AMIS | Verified auth/client/adapter/mappings, hybrid sync, idempotency, real contract integration tests; checkpoint | Pending tenant discovery and Phase 2 |
| 4 Payments | Draft/confirmation/allocation/reversal, evidence, audit, accounting integration tests; checkpoint | Not started |
| 5 Bonus & settlement | Targets, Support Pool, period state machine, immutable locking, auditable adjustments; checkpoint | Not started |
| 6 UI | Approved dashboard direction, accounting workflow, results/explanations, policy and sync health; checkpoint | Reference missing |
| 7 Hardening | Server RBAC verified, secrets, validation, audit/concurrency, retry and backup review; checkpoint | Not started |
| 8 Closure | Full tests incl approved golden/E2E; build/lint/typecheck/migrations/security and production evidence | NOT PRODUCTION READY |

Baseline server validation/authorization accompanies each feature; Phase 7 verifies the complete system. Checkpoint commits record coherent reviewed phase outputs, never credentials or unrelated workspace files. No remote/deployment destination was supplied.

Do not advance past a failed gate. Missing evidence must remain explicit. Phase 0 documentation is useful independent work; it does not satisfy live discovery, historical approval or production acceptance.

User explicitly authorized starting build after the approved direction. Phase 1 pure contracts accept explicit scenario context for unresolved recognition/VAT choices, without enabling them as production defaults. This is a foundation checkpoint, not completion of all production phases.

## Local application checkpoint — 2026-10-06

The independent manual-entry application is implemented and tested. Current behavior, role boundaries, configuration choices, validation evidence and external gates are recorded in [README](../README.md), [self-review](self-review.md) and [production readiness](../PRODUCTION_READINESS.md). Earlier architecture/phase proposals do not imply that AMIS or historical sources have been verified. Local configuration explicitly selects VAT basis, recognition/expense timing and order-date snapshots; no example policy rates are activated silently.
