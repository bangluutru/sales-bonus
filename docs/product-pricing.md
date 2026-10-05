# Product pricing and provisional GENKI catalog

## User-approved design

Each product can have its own list price and price history. Price changes create a new ProductPriceVersion with effective dates; historical order items retain a PriceSnapshot. No global hard-coded price. Product JAN is a source identifier pending validation, not an invented AMIS ID.

Proposed ProductPriceVersion fields: id, product_id, version, currency, unit/pack, input_amount, input_tax_basis INCLUDING_VAT/EXCLUDING_VAT, VAT policy/version/rate, exact excluding-VAT amount, effective_from/to, PROVISIONAL/DRAFT/APPROVED/RETIRED status, source/evidence/hash/page/row, change_reason, created_by/at and approval provenance. Dates and approval activation are required before an operational price version is used; quote date is provenance, not an automatic historical effective date.

At finalization capture price_version_id, amount, currency, pack, VAT basis/rate/version, effective context and provenance. Management pool rate and bonus policy snapshots remain independent. User can edit future catalog price; updating a past financially used record is replaced by new revision/adjustment. No silently recalculating a September order with November price.

RevenueCalculationPolicy version controls revenue basis (default EXCLUDING_VAT), effective dates and approved adjustment. Changing VAT basis creates a new version and clear preview/warning, never rewrites locked history. The list basis used for management pool is a separate explicit setting pending B01; do not infer it from the revenue basis decision.

## UI design

Product detail: JAN/SKU, product name, pack, current/provisional list price, whether input includes VAT, source VAT, derived pre-VAT value, effective dates, price history, source page and flags. “Thay đổi giá niêm yết” creates a draft version with reason and applicability preview. Display “Giá tạm tính từ báo giá 10/01/2025” until activated. Order explanation reads saved price version, never the current catalog.

Pricing edits and any approval are server-authorized and audited. Expense/adjustment approvers are Director/Admin as explicitly chosen. Policy and pricing administration must have explicit management permissions; no PM authority inferred from commercial discount discretion.

## Source evidence

Source file: `/Users/tranhaibang/Downloads/GENKI FAMI - CS GIÁ - Mẫu BÁO GIÁ.pdf`.
SHA-256: `c64c9d5a4258a9648ea7c65df304f41ebb831ba4873f111b9ef036e2f5fab9ad`.
All four pages visually inspected and text/table extraction cross-checked. Quote date 10/01/2025, 90-day validity. The user's provisional-use instruction does not establish current price/tax validity.

Page 1 contains 8 GENKI rows and 3 reference rows; pages 2/3/4 contain 17/17/1 reference rows. Total 46. Prices are per listed retail pack, not per tablet or case. The column describing 24/48/etc packs per case for main products is preserved separately.

The footer states prices include VAT: 8% for all products, with Omega-3 at 10%. For provisional conversion, SHARK LIVER OMEGA-3 is mapped to 10%; other rows carry 8% from the general note. DHA/EPA-related reference products carry a review flag because the scope of “Omega-3” exception is not unambiguous. These are source-derived provisional assumptions, not assertions about current tax law. No current legal tax research is claimed.

CSV preserves original gross list price, source quotation discount/dealer price, exact pre-VAT rational numerator/denominator, source row/page/section/hash and review flags. It does not contain operational discount defaults or activated effective dates. Exact pre-VAT = gross × 100 / (100 + source VAT percent). Preserve fractions until the approved rounding stage; do not round price, VAT or each intermediate operation up to 1,000.

| Product | Source list price incl. VAT | Provisional source VAT | Exact pre-VAT list amount |
|---|---|---|---|
| OKINAWA KASSOU FUCOIDAN | 3,200,000 VND | 8% | 80,000,000 / 27 VND |
| SHARK LIVER OMEGA-3 | 790,000 VND | 10% | 7,900,000 / 11 VND |
| SUPOMACA | 790,000 VND | 8% | 19,750,000 / 27 VND |

## Anomalies and verification

- JAN `4580814751248` (Akamama Vitamin & Mineral) fails the EAN-13 checksum. Preserve printed value; flag for identity review. Do not guess a replacement or auto-map it to AMIS.
- Page 3 row 21 price text visually overlaps; extracted values 318,000 / 238,500 reconcile at source 25% discount. Keep a review flag.
- Page 3 rows 30–32 product descriptions overlap/clipped. Store concise normalized product labels, not medical claims; raw source remains the PDF. Do not treat label normalization as product identity verification.
- All 46 source dealer-price equations reconcile exactly: retail list × (100 − source discount percent) = dealer price × 100. There are no repeated printed JANs.
- Financial rounding and example rules are documented; no engine/golden regression has run.

[Provisional catalog CSV](../data/reference/genki-product-prices.provisional.csv) · [Source manifest](../data/reference/genki-product-prices.source.json)
