# Build checkpoint

Updated: 2026-10-05, Asia/Tokyo. User explicitly authorized starting build after design decisions.

Current phase: PHASE 1 FOUNDATION CHECKPOINT implemented; remaining financial/source decisions not activated. NOT PRODUCTION READY.

## Completed

- Discovery docs and 46-product provisional catalog with exact source-price reconciliation and provenance flags.
- Git initialized on main; TypeScript/Node toolchain, lockfile, ESLint, strict build/typecheck.
- Exact rational money primitives, configurable policy resolution and immutable management/price snapshots.
- Canonical deterministic item calculation, approved expenses, zero bonus/trace for negative pools, explicit partial-collection scenarios, payment allocation and target qualification.
- Configurable Support shares, configurable upward rounding (approved quantum 1,000 VND) and separate rounding deltas.
- Pure adjustment approval and period transitions, immutable settlement snapshot helper.
- PostgreSQL domain schema for all requested entities, conservation/same-order constraints, immutable confirmed receipt/allocation/audit/settlement facts, locked calculation protection and Director/Admin approval constraints.
- 24 passing tests: 19 domain + 5 isolated PostgreSQL migration tests via PGlite. Lint, typecheck, build and reference validation passed; npm audit reports zero vulnerabilities. No live database migration tested.

## Scheduled continuation

Active one-shot same-chat automations: 2026-10-05 23:55 (`ti-p-t-c-sales-bonus-23-55`) and 2026-10-06 05:00 (`ti-p-t-c-sales-bonus-05-00`), Asia/Tokyo. See docs/resume-build.md.

Run `node scripts/resume-build.mjs` to read checkpoint and check changed inputs. It skips repeated checks if a matching passing fingerprint exists. It does not launch another model or reset limits. Native app scheduling wakes the continuing agent; machine must be on/awake and app running.

## Next actions and gates

1. Inspect git status/log and latest tests first. Preserve existing edits. If interrupted before checkpoint commit, finish validation and commit coherent foundation.
2. Continue Phase 1 application/schema review where independent; document remaining gaps (policy approval overlap/concurrency, complete audited services, authenticated RBAC, final production context wiring).
3. Phase 2 requires actual workbook sheets 2603–2609, anomaly review and approved normalized Golden Dataset. Source price PDF is not historical bonus evidence. No workbook exists in supplied inputs.
4. Phase 3 requires read-only authenticated tenant spike, real redacted AMIS payloads and approved stable identity/discount/list mapping. Do not invent endpoints or fields. No secrets are supplied or stored in this repository.
5. Remaining decision details are in docs/business-decisions.md, especially pool list VAT base/effective dates, recognition/expense timing, cash VAT allocation and refund carry-forward/recipient treatment. All scenario functions require explicit context; there are no active operational defaults for these missing choices.
6. Do not bypass gates to build/publish misleading financial screens. Continue independent work if useful; if dependent work cannot proceed, report concrete required sources without claiming production completion.

No UI, live AMIS, approved historical regression, operational payment/settlement service, live database, deployment or remote push completed. No additional schedules requested. Do not deploy/push, fabricate financial inputs, consume reset credits or mark PRODUCTION READY.
