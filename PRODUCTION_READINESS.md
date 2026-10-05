# Production readiness

**NOT PRODUCTION READY — Phase 1 foundation checkpoint, 2026-10-05.**

| Acceptance | Evidence status |
|---|---|
| Domain ambiguities resolved | User decisions recorded for prices, before-VAT revenue, negative pools, refund recovery, expense/adjustment approvers, Support departments and 1,000-VND ceiling; remaining source/recognition decisions pending |
| AMIS official v2 research | Public docs reviewed; inconsistencies recorded |
| Live tenant API discovery/auth/mappings | Not performed; secure test access and payloads absent |
| Reliable hybrid synchronization/no duplicates | Not implemented/tested |
| Per-product/versioned management policies and snapshots | Foundation implemented and tested where applicable; operational lifecycle not complete |
| Discounts, partial/multi-product receipts, reversals/refunds | Rules pending; not implemented/tested |
| Exact deterministic calculations and explanations | Pure domain scenarios implemented/tested; production contexts and historical validation pending |
| Accounting collections and settlement workflow | Not implemented/tested |
| Locked history, auditable adjustments | Foundation implemented and tested where applicable; operational lifecycle not complete |
| Server RBAC and secrets | Foundation implemented and tested where applicable; operational lifecycle not complete |
| Golden Dataset approved/regression pass | Workbook missing; zero historical cases approved |
| Unit/integration/E2E/security | 19 domain + 5 isolated SQL migration tests pass; AMIS/service/E2E/security authorization checks pending |
| Build/lint/typecheck/migration verification | Lint, strict typecheck and build pass; clean SQL migration tests pass in PGlite; live upgrade/restore verification pending |
| Backup restore/production operations | Not configured/tested |
| Dashboard visual approval | Reference missing |

Only mark PRODUCTION READY after actual evidence supports every directive acceptance requirement. Documentation existence and synthetic test fixtures are insufficient. No application, live URL, deployed service or completed phase checkpoint is claimed.

Verification: `node scripts/resume-build.mjs` (runs `npm run check`) passed after lint corrections; 24/24 tests, 46 exact catalog reconciliations and conversions. `npm audit`: zero reported dependency vulnerabilities. `git diff --check`: clean. None of these imply real AMIS, historical approval, live database, application RBAC or production readiness.
