# Test plan and acceptance gates

Phase 1 tests were written first, initially failed while domain module was absent, then passed after implementation. Current baseline: 19 domain tests plus 5 isolated PostgreSQL migration tests. Tests use exact money strings/integers and independent expected values. Historical/AMIS/service/E2E checks remain pending.

| Layer | Required meaningful cases |
|---|---|
| Policy unit | PRODUCT > PRODUCT_GROUP > ALL, effective edges, overlapping policies reject, missing policy reject, immutable 45% September snapshot after 40% November version |
| Discount/pool unit | Product A 45%, B 50%; same product differing discounts yield different residuals; canonical discount deducted once; every expense category; pending expense treatment; negative residual/over-discount per approved decision |
| Money/allocation unit | 60m/40m item net with 50m receipt => 30m/20m; unequal cents and stable tie; exact sum; payment fragmentation invariance; huge amounts beyond safe Number; manual sum mismatch, zero/negative weights, mixed currency reject |
| Recognition unit | 70m September + 30m October of 100m net; multiple products/payments; draft excluded; confirmed included exactly once; repeated confirmation; reversal/refund/cross-period correction per approved dates |
| Bonus/target unit | Configurable shares sum 100%; exact conserved shares; below target keeps calculated/earned but payable zero; at target payable; missing/zero target; owner changes per approved rules |
| Period/adjustment unit | Only approved OPEN->REVIEW->LOCKED->PAID transitions; lock snapshots; future policies cannot change snapshot; approved application-period adjustment once; no historical mutation |
| Adapter integration | Redacted real tenant payload contract, decimal precision, null/unknown schema reject, approved custom-field mappings, no invented IDs; header/envelope/auth variants from verified spike |
| Sync integration | Same source/event repeated gives one entity; concurrent webhook/reconciliation; pagination restart; out-of-order update; missing item identity quarantine; source price changes on locked items raise issue; auth renewal, backoff and rate limits |
| Payment integration | Server RBAC, same-order allocations, confirmation atomic with audit, double submit, concurrent receipts, source revision conflict, reverse once, accounting evidence |
| Settlement integration | Concurrent lock/payment cannot race; audit failure rolls back; immutable rows and foreign references protected; rerun reads saved trace; payout evidence and adjustment approval |
| E2E accounting | Accounting finds order, drafts receipt, checks allocations, confirms, dashboard cash updates, “Xem cách tính” reconciles, review/lock/pay; PM/auditor mutation denied server-side |
| Golden regression | Approved normalized cases for every usable 2603–2609 sheet, anomalies reviewed, exact expected line and period totals |
| Hardening | Cross-tenant/PM-ID access denied, secrets absent from bundle/logs/audit, invalid input/replay/CSRF as appropriate, backup restore, clean DB migration and upgrade |

Property tests: allocations conserve payment; shares conserve residual; full collection equals full entitlement under approved rules; payment splitting does not change final recognition; identical immutable inputs produce byte-identical canonical output; explanation aggregates match stored settlement exactly. Test final cumulative corrections and cent-level ties with independently hand-verified fixtures.

## Closure commands after tooling exists

Required scripts: unit, integration, e2e, golden, lint, typecheck, build, migration verification and security checks. No guessed commands or fake success counts are recorded before package setup. Run `git diff --check` once Git exists. Record actual command, exit code, fixture/dataset versions and evidence in production readiness. Meaningful failures block progression; incomplete historical data blocks Phase 2.

## User decision acceptance additions — 2026-10-05

- Product-specific list prices, future price update preserves old order snapshot; source including VAT converts exactly; revenue basis defaults excluding VAT and configurable change preserves locked history.
- Discount above management pool warns; negative residual remains negative in trace while PM/Support calculated/earned/payable = 0 and reason recorded; positive items are not implicitly offset by other deficits.
- Final bonus ceiling to 1,000: zero, exact multiple, 1,001 -> 2,000, fractional rational; sum exact lines before rounding; target-unqualified payable zero. Separate rounding delta reconciles independent recipient rounding without altering cash allocations.
- Support exact shares 60/20/20 within configured Support Pool, not whole residual; 1,001 pool fixture gives raw 600.6/200.2/200.2 and rounded 1,000/1,000/1,000 with shown 1,999 delta. Individual recipients remain unspecified.
- Director/Admin approve expenses and adjustments; PM/Auditor denied server-side. Approval races and changed stale amount fail; no assumed mandatory maker/checker prohibition.
- Post-lock refund warning creates reviewable clawback against already received benefit; approval/edit reason captured; repeated refund adjustment cannot apply twice; source paid settlement unchanged. Automated proportionality/carry-forward tests wait for approved B04 details.
- Catalog extraction check: 46 unique printed JANs, 46 exact quotation discount/dealer reconciliations; invalid JAN and overlapping source text flags retained. This validates source extraction only, not financial engine or historic golden values.

Implemented commands: `npm run test:unit`, `npm run test:migrations`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run validate:reference`, combined `npm run check`. No Golden Dataset or browser E2E command is claimed as passing.

## Local application checkpoint — 2026-10-06

The independent manual-entry application is implemented and tested. Current behavior, role boundaries, configuration choices, validation evidence and external gates are recorded in [README](../README.md), [self-review](self-review.md) and [production readiness](../PRODUCTION_READINESS.md). Earlier architecture/phase proposals do not imply that AMIS or historical sources have been verified. Local configuration explicitly selects VAT basis, recognition/expense timing and order-date snapshots; no example policy rates are activated silently.
