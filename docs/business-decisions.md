# Business decision register — updated 2026-10-05

The user's direct decisions below override earlier design proposals. Only unresolved portions remain pending. No unanswered alternatives are activated implicitly.

| ID | Status | Decision and remaining detail |
|---|---|---|
| B01 | PARTLY RESOLVED | Editable product-specific versioned list prices; provisional initial prices from supplied GENKI PDF; VND. Revenue basis defaults EXCLUDING_VAT and must be configurable/versioned. PDF source prices INCLUDE VAT. Pool remains based on list economic value per directive; confirm whether its list base also excludes VAT, and price activation dates. No retroactive substitution of current price. |
| B02 | PENDING SOURCE DISCOVERY | Transaction discount remains authoritative AMIS pricing when verified. PDF 25%/30% discounts are quotation references, not order defaults or company bonus rules. Negotiated selling-price differences versus list and exact source discount fields still need discovery. |
| B03 | RESOLVED | Discount exceeding management pool produces warning. Negative residual produces zero PM/Support incentive and explicit reason; raw negative residual remains visible, never erased. Deficit accounting/company treatment is separately unresolved. |
| B04 | PARTLY RESOLVED | After-lock refunds recover bonus already received through traceable clawback/offset adjustment, with warning and authorized adjustment. Never rewrite locked settlements. Application period, offsets when future bonus is insufficient, recipient responsibility, refund-before-lock and target offsets need explicit rules before automated posting. |
| B05 | RESOLVED FOR EXPENSE/ADJUSTMENT APPROVAL | Director or Administrator approves expenses and adjustments. Director maps to EXECUTIVE with explicit approval permission; ADMIN also has permission. Payment confirmation remains Accounting. Target/override approval details not answered. No mandatory maker/checker approval block inferred from previous proposal. |
| B06 | RESOLVED | User selected round upward to 1,000 VND at final person/department bonus total; show rounding delta separately. Payment allocations conserve actual receipt and do not round to 1,000. Formula/exact examples in calculation specification. |
| B07 | RESOLVED TEMPORARILY | Support Pool uses configurable FIXED_PERCENT: MKT 60%, Kế toán 20%, Kho vận 20%. These are shares inside Support Pool, not overall residual shares. Individual distributions can be defined later; no person payout implied by department share. |
| B08 | PENDING | Missing/zero targets, PM reassignment and collection attribution. |
| B09 | PENDING | BonusPolicy version date and expense accrual/recognition for partial payments. |
| B10 | PENDING | Dashboard cohort definitions and collection-rate denominator. |
| B11 | PENDING | Business accounting timezone and period calendar; device timezone is not sufficient evidence. |
| B12 | PENDING | Overpayment, zero-net, free goods, currency conversion and tax/shipping collection allocation. |
| B13 | PENDING | REVIEW write behavior and partially paid settlements. |
| B14 | PARTLY DESIGNED | Version/snapshot editable prices and basis/rules; future changes never alter historical orders/locked periods. Policy effective edges and source edits on finalized orders require confirmation. |

## Source status

- Supplied price PDF inspected: 4 pages, 46 product rows (8 GENKI and 38 reference rows). Source date 2025-01-10, validity 90 days; authorized only as provisional price source. See [price design](product-pricing.md) and [CSV](../data/reference/genki-product-prices.provisional.csv).
- Workbook sheets 2603–2609 still not supplied; price quote is not historical bonus evidence or an approved Golden Dataset.
- Approved dashboard reference still missing.
- AMIS tenant read-only spike and redacted payloads still pending. Configure secrets server-side; no credentials in chat/Git.

Phase 0 design and source normalization can continue independently. Production calculations and adapter implementation remain gated by unresolved financially consequential inputs under directive section 33.
