# AMIS field mapping — discovery draft, NOT approved

Source: [MISA official technical V2 sections IV/V](https://www.misa.vn/155017/tai-lieu-open-api-tich-hop-misa-crm/). Refer to [discovery](amis-api-discovery.md) for contradictions and current setup guidance. Base candidate: `https://amisapp.misa.vn/crm/gc/api/public/api/v2`.

Paths below are **relative to an individual entity decoded from the response `data`**, not assertions about an observed response root. List envelope and decoding await tenant evidence. A documented field does not establish nullability, availability, accounting meaning or suitability. Endpoint column denotes GET /resource candidates only. All example values are **synthetic illustrations**, never retrieved tenant values. Unknown examples are explicitly absent. All mappings are inbound AMIS → Commission; no CRM writes.

| AMIS endpoint candidate | AMIS JSON path (entity-relative) | Internal canonical field | Datatype | Nullable | Example value (synthetic) | Transformation / validation | Direction |
|---|---|---|---|---|---|---|---|
| GET /SaleOrders | UNVERIFIED — AMIS FIELD GAP | Order.external_id | Unknown → string ID | Unknown; internal required | Not observed | Require stable immutable source ID; never use order number as guessed ID | AMIS → Commission |
| GET /SaleOrders | $.sale_order_no | Order.number | String | Unknown; internal required | EX-2609-001 | Preserve text; uniqueness is tenant-scoped, not proof of identity | AMIS → Commission |
| GET /SaleOrders | $.sale_order_date | Order.order_date | DateTime → business date | Unknown; internal required | 2026-09-15 | Parse observed timezone/format; no use of book_date as substitute | AMIS → Commission |
| GET /SaleOrders / Customers | UNVERIFIED — AMIS FIELD GAP | Order.customer_id / Customer.external_id | Unknown → string ID | Unknown; internal required | Not observed | Verify ID linkage; names cannot serve as unique identities | AMIS → Commission |
| GET /SaleOrders | $.account_name | Order.customer_name_source | String | Unknown | Example customer | Preserve display name; compare approved customer mapping | AMIS → Commission |
| GET /Customers | $.account_name | Customer.name | String | Unknown | Example customer | Preserve; do not deduplicate by name | AMIS → Commission |
| GET /Customers | $.account_number | Customer.code | String | Unknown | KH-EX-001 | Preserve; not assumed to be immutable ID | AMIS → Commission |
| GET /SaleOrders | UNVERIFIED — AMIS FIELD GAP | Order.owner_external_id | Unknown → string ID | Unknown; internal required | Not observed | Require stable ID or approved explicit employee binding | AMIS → Commission |
| GET /SaleOrders | $.owner_name | Order.owner_name_source | String | Unknown | Example PM | Display only; duplicate names cannot auto-map | AMIS → Commission |
| GET /Product | $.id | Product.external_id | Integer → string ID | Documented required; null behavior unobserved | 123 | Lossless integer parsing; verify source link from order item | AMIS → Commission |
| GET /Product | $.product_code | Product.sku | String | Unknown | SKU-EX-A | Preserve code; confirm code identity/change behavior | AMIS → Commission |
| GET /Product | $.product_name | Product.name | String | Unknown | Example product A | Preserve | AMIS → Commission |
| GET /Product | $.product_category | Product.group_source | String | Unknown | Example group | Map to approved internal ProductGroup, snapshot effective group | AMIS → Commission |
| GET /Product | $.inactive | Product.active | Boolean | Unknown | false | Invert observed Boolean; missing does not default to active | AMIS → Commission |
| GET /SaleOrders | $.sale_order_product_mappings[*].product_code | OrderItem.product_code_source | String | Unknown | SKU-EX-A | Resolve against verified product mapping; item product ID linkage remains gap | AMIS → Commission |
| GET /SaleOrders | UNVERIFIED — AMIS FIELD GAP | OrderItem.external_id | Unknown → string ID | Unknown; internal required | Not observed | Require stable line identity; never array index or SKU alone | AMIS → Commission |
| GET /SaleOrders | $.sale_order_product_mappings[*].amount | OrderItem.quantity | Decimal → exact decimal | Unknown; internal required | 2 | Preserve exact precision; verify quantity_ordered vs amount semantics | AMIS → Commission |
| GET /SaleOrders | UNVERIFIED — AMIS FIELD GAP | OrderItem.reference_list_unit_price | Exact money decimal | Unknown; internal required | Not observed | Approved historical price/custom field needed; never current product price | AMIS → Commission |
| GET /Product | $.unit_price | Product.current_selling_price_source | Decimal | Unknown | 1000000 | Reference only; not historical order list price | AMIS → Commission |
| GET /SaleOrders | $.sale_order_product_mappings[*].price | OrderItem.selling_unit_price_candidate | Decimal | Unknown | 1000000 | BLOCKED: duplicate conflicting price descriptions; verify tenant semantics | AMIS → Commission |
| GET /SaleOrders | $.sale_order_product_mappings[*].discount_percent | OrderItem.discount_rate_source | Decimal → exact ratio | Unknown | 10 | Divide exact percentage by 100; reconcile approved amount, never deduct twice | AMIS → Commission |
| GET /SaleOrders | $.sale_order_product_mappings[*].discount | OrderItem.discount_amount_candidate | Decimal → money | Unknown | 200000 | BLOCKED pending currency/VAT semantics and discount_oc comparison | AMIS → Commission |
| GET /SaleOrders | $.sale_order_product_mappings[*].to_currency_after_discount | OrderItem.net_value_candidate | Decimal → money | Unknown | 1800000 | BLOCKED pending net/VAT basis; never use total without approval | AMIS → Commission |
| GET /SaleOrders | $.sale_order_amount | Order.sales_value_source | Decimal → money | Unknown | 1800000 | Reconciliation only until exact net/tax/charge semantics approved | AMIS → Commission |
| GET /SaleOrders | $.discount_summary | Order.discount_summary_source | Decimal → money | Unknown | 200000 | Reconcile lines; do not add to line discounts again | AMIS → Commission |
| GET /SaleOrders | $.currency_type | Order.currency | String → approved ISO currency | Unknown; internal required | VND | Validate observed enum; no silent currency default | AMIS → Commission |
| GET /SaleOrders | $.status | Order.source_status | String | Unknown | Đang thực hiện | Approved explicit enum mapping; retain revenue_status separately | AMIS → Commission |
| GET /SaleOrders | $.created_date | Order.source_created_at | DateTime | Unknown | 2026-09-15T09:00:00 | Require verified timezone/format; preserve raw redacted fixture | AMIS → Commission |
| GET /SaleOrders | $.modified_date | Order.source_updated_at | DateTime | Unknown | 2026-09-16T09:00:00 | Description inconsistent; verify payload, never assume total ordering | AMIS → Commission |
| GET /SaleOrders | $.total_receipted_amount | Order.crm_collected_reference | Decimal → money | Unknown | 70000000 | Reconciliation reference only; cannot generate confirmed Payment | AMIS → Commission |
| GET /SaleOrders | $.balance_receipt_amount | Order.crm_outstanding_reference | Decimal → money | Unknown | 30000000 | Reconcile against ledger; not application-authoritative balance | AMIS → Commission |

## Mapping approval and fallback

Every AMIS FIELD GAP means unavailable/unestablished in evidence reviewed, not proof the vendor cannot supply it. Resolve with redacted payload and vendor clarification first. Approved configurable mapping can bind an observed native or tenant custom field to a canonical field. Record mapping ID/version, exact endpoint/path, type, scale, nullable contract, source evidence, transformation rule, reviewer, effective period and test fixture hash. Do not preselect `custom_field23` just because documentation mentions it as an example.

Mapping functions are restricted typed transformations (lossless IDs, exact decimals, dates, explicit enums), not arbitrary code. No implicit zero/null substitutions for financial inputs. Validate source precision before JSON number decoding loses it. Name-to-ID and SKU-to-item-ID guesses are prohibited. Missing stable identity/authoritative list price/discount yields a review issue and prevents settlement eligibility.

Compare native line and order totals including VAT/currency/charges; conflicts require review. Retain raw redacted source evidence and canonical source/mapping revision. A mapping change affecting historical economics cannot rewrite locked settlements. Mapping and employee binding changes are audited and versioned.

## Product-price fallback approved in principle

User permits versioned product-specific list prices, initially from GENKI PDF. Canonical list price can use an approved local ProductPriceVersion/PriceSnapshot fallback with explicit LOCAL_PRICEBOOK provenance if AMIS lacks authoritative historical list price. It must never be labeled as synchronized AMIS price. Stable product mappings and applicable effective dates still require evidence; unresolved JAN checksum stays flagged. Revenue is before VAT by default and adjustable; PDF discounts remain references and do not resolve authoritative AMIS discount mapping.
