# Production readiness

**LOCAL APPLICATION COMPLETE · NOT PRODUCTION READY** — 2026-10-06, Asia/Tokyo.

The manual-entry application is implemented, runs locally and passes the checks below. This status does not certify live AMIS synchronization or historical source truth.

| Acceptance | Evidence |
|---|---|
| Product prices and VAT basis | 46 provisional PDF records; editable approved immutable versions, explicit effective dates; source-only exact reconciliation passes |
| Per-product/group/versioned management pool | Server services and UI; PRODUCT > PRODUCT_GROUP > ALL, immutable order snapshots; policy precedence and date boundaries tested |
| Transactional customer discounts | Per-item input; no fixed dealer discount substituted; discount-over-pool warning |
| Confirmed partial/multi-product collections | Draft/confirm/reversal services; exact cash-conserving allocations, manual override with reason, duplicate/overcollection checks tested |
| Deterministic incentives | Integer/rational engine; pre-VAT or including-VAT explicit configuration; pending expenses excluded and block closure; negative residual yields zero incentives and retains deficit |
| Targets and final rounding | Period targets; calculated/earned retained below target, payable zero; final person/department net total ceilings to 1,000 with separate delta, including approved offsets |
| Support departments | Configured initial 60:20:20; individual allocation intentionally deferred by user |
| Settlement workflow | Chronological OPEN → REVIEW → LOCKED → PAID; transactions, immutable snapshots and payout evidence; empty periods can close without requiring targets for inactive old orders |
| Refund recovery | References already-paid settlement; pending warning; Director/Admin can change amount/application period; source payout cap; one application; original snapshot remains unchanged |
| Server RBAC | All mutation routes enforce roles; own-PM order/report/settlement scope and Director/Admin approvals verified by HTTP tests; no supplied/default credentials |
| Local security | Salted scrypt hashes, hashed expiring sessions, HttpOnly/SameSite cookies, same-origin POST guard, loopback bind/Host restriction, CSP, escaped UI, JSON bounds, login throttling; audit excludes passwords |
| Persisted database/migrations | Clean migration001+002, reopening persistent database, immutable financial/configuration guards tested in real PGlite PostgreSQL |
| Backup/restore | Authenticated audited gzip backup, CLI restore into fresh directory, existing-directory refusal, restored data equality and session invalidation tested |
| UI/E2E | Vietnamese accounting workflow, 9 pages, in-app sequential 9-topic guide with context-sensitive help, calculation explanation, price/policy/group management, desktop/mobile review and no horizontal overflow, including mobile guide and order dialog |
| Automated checks | 27/27 domain/SQL/HTTP tests; Chrome E2E passes; lint/typecheck/build and 46 source-price checks pass; npm audit reports 0 vulnerabilities |
| Live AMIS discovery/sync/webhooks | **Missing external input**: tenant credentials, redacted payloads, authoritative identities/price/discount/owner and auth/webhook contract; not connected or claimed tested |
| Historical Golden Dataset | **Missing workbook**: sheets2603–2609; zero historical cases approved. Independent synthetic oracle is clearly labelled |
| Deployment/production operations | Not deployed. Local single-process application; shared production requires deployment design, TLS/secure cookies, central database/operations and actual restore/security acceptance in that environment |
| Approved dashboard reference | Not provided; implemented local visual direction has been reviewed via screenshots, not represented as supplied approval |

No AMIS API fields or historical figures were invented. Unsupported source rules and automatic refund allocation/carry-forward remain explicit gates. The user can independently use the local manual workflow after configuring its financial rules.

Evidence: [self-review](docs/self-review.md), [application HTTP tests](tests/application.test.ts), [browser E2E](tests/browser.spec.mjs), [domain tests](tests/domain.test.ts), [migration tests](tests/migrations.test.ts), [source validation](scripts/validate_reference_prices.py).
