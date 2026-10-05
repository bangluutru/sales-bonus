# Calculation specification — updated 2026-10-05

User-approved rules are explicit below. Unanswered recognition/source details remain pending; pure canonical domain engine now exists for explicit scenario inputs; approved historical regression and operational activation are pending.

## Prices, VAT and named amounts

Product prices are editable/versioned with order-item snapshots; provisional source is [GENKI catalog](product-pricing.md). Default sales revenue basis is EXCLUDING_VAT, with versioned configurable adjustment. Source PDF list prices INCLUDE VAT. Convert using exact arithmetic and snapshotted tax/basis context; retain cash including VAT separately from eligible collection revenue excluding VAT. Cash allocation across VAT/tax/charges still needs B12. Management pool list-base VAT context remains B01, separate from revenue basis.

For an item: G approved reference/list economic value; D authoritative total customer discount; N net sales value on selected basis; C eligible confirmed collected allocation; M management pool; E approved eligible costs excluding duplicate discount; R raw residual.

`M = G × snapshotted pool rate`; `R = M − D − E`. Do not assume N=G−D before source discount and negotiated price semantics are verified. PDF quotation discounts 25%/30% are reference evidence only; do not assign them automatically to orders. AMIS remains authoritative when verified.

## Negative pools and warnings — APPROVED

If D > M, show CUSTOMER_DISCOUNT_EXCEEDS_MANAGEMENT_POOL warning with exact excess, source and related item. Do not silently block commercial order synchronization.

For R < 0, incentive base is zero: PM calculated/earned/payable incentive for this item = 0; Support incentive contribution = 0. Keep R negative in the trace, with reason NEGATIVE_RESIDUAL_POOL and breakdown of discount/cost deductions. No positive item is silently netted against negative-item deficit without a separately approved policy. If R = 0, bonus is zero with explicit zero-pool trace.

For R >= 0, configured BonusPolicy PM/Support/Company shares total exactly 100%. For negative R, financial loss/company accounting treatment is separately pending; zero employee incentive does not erase the deficit or manufacture a zero company loss. Company totals must identify negative economic residual separately.

## Partial collection — pending recognition details

Proposed cumulative earned entitlement = full item entitlement × cumulative eligible confirmed collection / eligible N, with period earned amount equal to closing less opening entitlement. Draft receipts earn zero; confirmed events count once. Costs timing, bonus-policy effective date and VAT allocation await B09/B12. Zero/negative denominators and overcollection require approved exceptions. Never round each payment independently.

Directive example: 100m net, 70m September + 30m October; recognize corresponding portions without double counting. Examples are synthetic, not workbook evidence.

## Exact arithmetic and receipt allocation

Use arbitrary precision minor-unit integers plus rational/decimal rates/quantities. JSON money uses exact strings; no Number intermediate. Receipt allocations must sum exactly to original confirmed cash. Proposed largest-remainder distribution at currency minor-unit precision with stable item-ID ties; do not apply the 1,000 VND bonus rounding rule to cash allocations. Manual override validates order/currency/sum and requires authorized Accounting reason.

## Bonus rounding — APPROVED BY USER

At final person/department bonus total, round a nonnegative amount upward to the nearest 1,000 VND: `rounded = 1000 × ceil(exact_total / 1000)`. Zero remains zero and exact multiples remain unchanged. Sum exact eligible lines first; do not round list prices, expenses, VAT, each order line or each payment up to 1,000. Store rounding stage, quantum, mode and delta in the policy/snapshot.

Examples: 0 -> 0; 1 -> 1,000; 1,000 -> 1,000; 1,001 -> 2,000; exact 80,000,000/27 -> 2,963,000 if that value were a final incentive total (not a price-rounding instruction).

PM below target stays payable zero; round only the amount actually payable after the gate, while showing exact calculated/earned and projected rounded amount separately. Support currently rounds at department total, not unidentified individuals. A future person strategy must specify one final rounding stage to avoid rounding twice.

Independent upward rounding can exceed original pool. Show raw allocations, rounded payouts and explicit ROUNDING_DELTA: `sum(rounded payouts) = sum(exact payouts) + sum(rounding deltas)`. Do not silently deduct excess from Company or alter actual receipts. Company economic share remains separate; a funded payout budget accounts for the shown delta. Target achievement uses exact values, never rounded cash.

Synthetic conserved trace: eligible Support Pool 1,001 VND => MKT exact 600.6, Accounting 200.2, Logistics 200.2. Rounded departments are 1,000 each; total 3,000, delta 1,999. Raw shares sum to 1,001; payout plus shown rounding adjustment reconciles to 3,000. A hidden correction is prohibited.

## Targets and temporary Support distribution

PM target gate remains directive behavior: payable from earned only when target reached; retain calculated/earned below target. Missing/zero targets and attribution await B08. No invented tiers.

SupportDistributionPolicy version uses FIXED_PERCENT with department shares MKT 60%, ACCOUNTING 20%, LOGISTICS 20%, sum exactly 100%. This is inside Support Pool. Overall residual PM/Support/Company percentages remain configured BonusPolicy, not changed by department shares. Recipient staff can be assigned later; no automatic individual payout. Snapshot strategy/rates/departments for historical settlements.

## Refund after lock — APPROVED recovery direction

Preserve locked settlement and original payout evidence. Record refund transaction/evidence and linked original order/items, allocations and paid bonus. Produce clawback proposal referencing original snapshotted entitlement already received, not current policies and not the entire refunded customer cash. Show refund/previous payout/proposed recovery and warning REFUND_AFTER_LOCK_REQUIRES_ADJUSTMENT.

Director/Admin approves or adjusts recovery amount with reason. Approved Adjustment is applied exactly once to a designated application period and offset against later bonus, referencing the paid source settlement and recipient/bucket. Display base bonus, rounding delta, approved clawback and remaining payable separately. Do not silently recompute old entitlement. Recovery cannot silently duplicate another recovery event.

Specific refund proportionality, negative adjustment rounding, insufficient future bonus/carry-forward, multiple recipients, and effect on targets are pending B04. Until defined, calculate only a review proposal; no guessed automatic posting. User-approved recovery does not authorize deleting the old Payment or modifying locked settlement.

## Expense and adjustment approval

Director (EXECUTIVE with explicit director authority) or ADMIN approves expenses/adjustments. Only APPROVED eligible expenses participate; draft/pending expenses remain visible as reconciliation issues. Do not lock with unresolved material expense approval. Approval records identity, time, exact amount/version and reason/evidence. Accounting records/reconciles payments; PM cannot approve expenses or adjust calculated results.

## Period workflow, explanation and immutability

OPEN -> REVIEW -> LOCKED -> PAID as directive. REVIEW edit behavior/payout granularity await B13. Lock snapshots prices/VAT/basis, management and bonus policies, support strategy, targets, receipts/allocations, expenses, rounding, adjustments, source/mapping/engine versions and full exact trace. Future price/rate/basis changes never rewrite history.

“Xem cách tính” reads that same trace: product/order -> list price snapshot/basis -> gross -> authoritative discount -> net -> eligible confirmed allocation -> management rate/pool -> each approved expense -> raw residual/warnings/zero reason -> PM/Support/Company exact shares -> support department split -> target gate -> exact payable -> rounding quantum/delta -> approved refund adjustment -> payable. Sum explanations and adjustment entries exactly to stored totals.

Missing identities/prices, inconsistent source economics, unapproved required rules or unsupported currency prevent settlement eligibility. Approved negative-residual zero-bonus behavior yields warning and trace, not missing-data fabrication.

Implementation evidence: [domain entrypoint](../packages/domain/index.ts), [tests](../tests/domain.test.ts). Finalization quantum is caller-supplied configuration (`1000` in approved user directions), not an implicit compiler constant. Recognition and economic basis must be explicit input; no AMIS/source mapping or operational period default is selected by these functions.
