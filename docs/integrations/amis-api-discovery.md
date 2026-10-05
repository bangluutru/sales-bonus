# AMIS CRM API v2 discovery

Checked: 2026-10-05. Status: **public-documentation spike completed; authenticated tenant spike NOT performed. Adapter implementation blocked.**

## Primary sources

- [MISA technical Open API document](https://www.misa.vn/155017/tai-lieu-open-api-tich-hop-misa-crm/), published 2025-11-15; reviewed sections I–VI.
- [Current AMIS CRM API setup help](https://helpcrm.misa.vn/kb/api/), updated 2026-07-08.
- [MISA API overview](https://www.misa.vn/154981/tong-quan-open-api-misa-crm/).
- [Official linked V2 Google document](https://docs.google.com/document/d/1-7COvtGHRc-a6ox7F97Q0whlPI7tPnOhG-0zhrEXUn8/edit?tab=t.0): accessible page title, document body unavailable through browser text extraction. Not treated as additional verified schema evidence.

These are vendor documentation claims, not observed responses from the customer's tenant. No API requests were sent; there are no supplied test credentials or tenant fixtures.

## Documented API surface — candidates pending live verification

Base documented in technical section 1.2: `https://amisapp.misa.vn/crm/gc/api/public/api/v2`.

| Operation | Documented method/path | Evidence |
|---|---|---|
| Token | POST `/Account`, body client_id/client_secret | Technical section II |
| Product list | GET `/Product` | Section IV |
| Customer list | GET `/Customers` | Section IV |
| Order list | GET `/SaleOrders` | Section IV |
| Field lookup | GET `/{Select}/{Field}`, Field ID or Code, matching query parameter | Section IV.2; actual tenant lookup behavior unverified |

Page/pageSize/orderBy/isDescending documented; pageSize maximum 100. Index origin, termination/total count, paging consistency, ordering ties and filtering are not established. Documented business envelope uses success/code/data; whether data is a native array/object or JSON-encoded string must be captured rather than guessed. Treat business failure even with HTTP 200 as failure. Only read operations are planned for Commission.

## Contradictions and gaps

1. General section lists ACT-style token/dictionary/voucher paths and X-MISA-AccessToken, whereas CRM-specific sections II/IV list `/Account`, Authorization and Clientid. Current setup help specifies Bearer Authorization. Validate actual CRM V2 headers and endpoint; do not use ACT paths as fallback or send credentials to alternate guessed endpoints.
2. General response uses Data and ErrorMessage; operation examples use data. Inspect real payload casing and shapes; no blanket flexible parsing that hides drift.
3. Item `price` is described both as a line value and a unit price. Current product unit_price is not proven to be historical reference/list price. AMIS FIELD GAP: authoritative historical list price.
4. Item discount/discount_oc/discount_percent and after-discount amounts are documented, but VAT, currency and negotiated price semantics are not approved. AMIS FIELD GAP: authoritative economic discount definition. Order summary discount must reconcile with canonical line deductions once.
5. Stable order/customer/owner/item IDs and order-to-customer/product-ID relationships are not established by these object tables. Product id is documented as Integer. AMIS FIELD GAP: stable cross-entity identity and employee endpoint. Name alone cannot safely map employees or customers.
6. created_date/modified_date exist; order modified_date description incorrectly says editor while datatype says DateTime. Timezone, encoding and change-order guarantees require payload checks.
7. Callback configuration is described; event envelope, signature, replay identity, retry schedule, supported entities, deletion events and delivery guarantees are not specified in sources reviewed. AMIS FIELD GAP: secure webhook contract. No fabricated webhook event names or headers.
8. Current help limits product/stock/debt to reads and order updates to drafts, while the generic technical document lists broader CRUD. App ownership requires read-only CRM access regardless; do not infer write rights.
9. CRM receipt summaries do not establish payment transaction dates, status, evidence or allocations. Keep application-confirmed payment ledger authoritative.
10. Custom fields are documented as `custom_field[x]`, but exact customer field names/types and item support must be observed. Never pick a numeric custom-field slot without tenant configuration.

## Tenant spike plan / required evidence

Use a secure server test configuration, read-only access and a nonproduction tenant. Never put credentials in chat, Git or logs. Confirm vendor/version/tenant endpoint first. Store redacted fixtures with hashes and mapping approval, not tokens.

| Probe | Capture / pass criteria | Status |
|---|---|---|
| Auth | Correct endpoint/header/envelope, token expiry and disconnect behavior; redact request/response secrets | Pending |
| Lists and lookup | One page each for Product/Customers/SaleOrders, stable IDs, item identity and links; second page and end conditions | Pending |
| Economics | Single/multi-item orders, negotiated price plus discount, before/after VAT, currency variants, order discount, custom historical list price | Pending |
| Ownership | Stable owner identifier plus explicit employee mapping; duplicate names cause unresolved issue | Pending |
| Changes | Modified order, reordered/removed items, stale response behavior, status cancellation; no duplicate sync | Pending |
| Callback | Actual signed/authenticated callback specification and redacted payload, replay/duplicate tests, supported events | Pending |
| Reconciliation | Available pagination/filtering, cursors, throttle/errors and retry requirements; documented 429 handling if observed | Pending |

Unresolved required fields quarantine the order and block settlement; user-approved mapping/custom field must carry evidence and effective version. Mapping changes are audited. Verify historical revisions before using source edits on an already finalized order.

## Discovery exit

Business register resolved, tenant probes completed with evidence, required identity/economic mappings approved and golden historical behavior trusted. Public research alone does not complete Phase 0 or authorize a fabricated adapter.
