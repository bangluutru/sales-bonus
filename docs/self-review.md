# Self-test and self-review · 2026-10-06

## Scope and result

Local manual-entry app reviewed against the attached directive and latest approved decisions. All implemented local critical paths pass. Live AMIS, workbook historical regression and deployment remain unverified because their source/access inputs are absent. QA runs use isolated memory/temp databases; operating database remains at first setup.

## Independent financial oracle

Synthetic fixture, not historical business data:

- Two products: 10,800,000 VND including 8% VAT each; list value before VAT 10,000,000 each.
- A: discount before VAT 1,000,000; management pool45%; residual3,500,000. B: discount2,000,000; pool50%; residual3,000,000.
- Bonus policy explicitly configured35/30/35. First confirmed cash receipt9,180,000 across total18,360,000 allocates4,860,000 /4,320,000 exactly.
- Confirmed revenue before VAT8,500,000. PM earned1,137,500; target8,500,000 qualifies; payable1,138,000; rounding difference500.
- Support975,000 split585,000 /195,000 /195,000. Original September snapshot survives a later policy/configuration change and October receipt.
- Second half earns1,137,500 in October, without recounting September. Reviewed recovery1,500 creates exact net1,136,000 and final payable1,136,000, rounding delta0. This case catches rounding before the offset instead of at the final total.

## Meaningful checks

19 domain scenarios: exact/huge money, policy precedence/overlap/dates, snapshot prices, transactional discounts, approved/pending costs, negative pools, payment allocation, draft/confirmed/reversed receipts, targets, Support rounding and immutable history.

5 isolated SQL tests: schema/checks, cash conservation and same-order allocation, locked history/audit protections, financial approver checks, policy/price foreign keys.

3 application HTTP scenarios cover complete lifecycle and exact oracle; authentication/RBAC including own-PM locked reports and settlements; duplicate/overcollection handling; manual allocations; approval/refusal; reversal; negative-pool zero payout and warning acknowledgment; pending-adjustment closure guard; immutable input/configuration; later empty period; persisted reopening; authenticated backup and actual CLI restore into new directory, with existing-directory refusal and invalidation of restored sessions.

Chrome E2E: first Admin setup, explicit financial configuration, manual order creation, non-submit form controls, draft receipt confirmation, explanation, review/lock/pay, all9 navigation pages, product groups/policy, backup download and desktop/mobile layouts including order modal and session invalidation returning to login. Browser page errors absent; expected401 responses are verified in the expired-session scenario. Screenshots inspected at `tmp/qa-dashboard-desktop.png` and `tmp/qa-dashboard-mobile.png` (synthetic QA data).

## Issues found and fixed

- PostgreSQL DATE values were converted with JavaScript locale strings: normalized by SQL type to YYYY-MM-DD.
- Reversal cutoff compared JSON text to DATE: explicit cast corrected.
- Non-submit dialog buttons could submit forms: fixed button types.
- Decimal VAT/policy display could crash or truncate configured percentages: exact parser/percentage formatter, string casts in nested JSON.
- REVIEW could strand missing targets/pending approvals: eligibility and chronology checked before transition; unresolved refunds also block it.
- Negative pools blocked zero-incentive settlement: permitted with retained loss and explicit warning acknowledgment.
- Finalized input and approved costs were not all guarded against direct mutation: added DB immutable triggers, period-configuration protection and whole-settlement payout uniqueness.
- Old completed orders demanded new targets forever: report includes current-period activity/new orders plus approved adjustment recipients; empty periods can close.
- Old Support report could show current percentages: display uses saved period configuration.
- Approved offsets could produce a non-1,000-multiple payout: offset exact values before the single final ceiling; separate net exact/delta retained.
- Async navigation could display an older response; mobile line editor could overflow: generation guard and responsive grid fixed.

## Boundaries requiring real inputs or later scope

The local HTTP app is single-process and loopback-only; no central multi-user deployment is asserted. Backup files contain private financial/authentication data and must be held privately. AMIS official research and draft mappings are available, but no authenticated API call/webhook/synchronization is claimed. The 2025 quote is provisional and expired; approving an effective price requires an operator decision. Refund recovery amount/recipient is an explicit review input, because product-specific return allocation is not supplied. Insufficient future bonus blocks settlement; a Director/Admin may select a later open application period before approval. No automatic debt/carry-forward or target reduction is invented. No individual Support allocation or bank transfer integration is implemented.
