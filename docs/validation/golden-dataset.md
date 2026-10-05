# Historical workbook and Golden Dataset

Status: **BLOCKED — workbook absent; no approved historical values.**

Expected sheets: 2603, 2604, 2605, 2606, 2607, 2608, 2609. No related workbook exists among supplied attachments or this workspace. Nearby unrelated workbooks are not substituted. Missing sheets must be recorded individually after actual file inspection. Approved dashboard reference is also missing.

## Extraction process after source arrives

1. Hash source workbook, retain read-only copy outside Git, inventory sheets/formulas/cached values/date conventions/currencies/hidden rows and columns.
2. Extract with cell addresses and both formula and stored result; formula caches may be stale. Recalculate only in isolated copy with documented tool/version and review any differences.
3. Reconcile quantities, list/selling values, discounts, expenses, payments, target gates and employee mappings. Detect hard-coded rates, negative pools, inconsistent totals, mixed VAT bases, duplicate orders/payments, rounding drift and missing payment dates/statuses.
4. Produce anomaly register with sheet/cell, original formula/value, expected economics, proposed normalization, financial impact and reviewer disposition. Do not reproduce questionable formulas to match output.
5. Build normalized cases preserving source hash, sheet/cells, original result, corrections, approved exact expected calculated/earned/payable and Support/Company totals, reviewer and approval time.
6. Commit only redacted approved fixtures plus provenance; never original employee/customer/bank data by default. Approval updates dataset version/hash. Engine regression loads approved cases only.

## Required case structure

case ID; workbook hash; source sheet/cell ranges; evidence status; canonical products/orders/items; management/bonus policy snapshots; confirmed/draft/reversal payment events and allocations; expenses and approval; target/period; currency and rounding version; expected exact line/aggregate/calculated/earned/payable/support/company amounts; anomaly references; approval provenance.

Synthetic directive examples are separate unit fixtures. They never replace workbook regression. Historical regression cannot pass or be waived implicitly while workbook is absent.

## New source distinction

The GENKI 4-page quote dated 2025-01-10 supplies 46 provisional product-price references and quoted VAT/discounts. It contains no sheets 2603–2609, payment ledger or historical bonus outputs. It cannot satisfy the Golden Dataset gate.
