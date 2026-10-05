# MASTER BUILD DIRECTIVE
## PM Commission & Bonus Management System

### ROLE

You are the principal engineer responsible for designing and implementing a production-grade web application for calculating PM and support-team incentives based on sales orders, commercial discounts, management-pool policies, and confirmed cash collection.

Do not treat this project as an Excel-to-web conversion.

The application is a financial rules and settlement system.

Correctness, traceability, historical reproducibility, and auditability are more important than implementation speed.

---

# 1. CORE BUSINESS MODEL

The company assigns the PM responsible for commercial management a configurable percentage of the economic value of a product.

This allocation is called:

`PM Management Pool`

Approximately 45% is currently common, but 45% IS NOT a constant.

Management Pool Rate can vary by:

- product;
- product group;
- effective period.

Example:

Product A = 45%
Product B = 42%
Product C = 50%

The company may change these percentages in future periods.

Never hard-code 45%.

---

# 2. CUSTOMER DISCOUNT

Customer discount is NOT a fixed company bonus-policy parameter.

The PM has commercial discretion to determine customer discount within the company's operating rules.

Therefore:

higher customer discount
→ less Management Pool remaining

lower customer discount
→ more Management Pool remaining.

Discount must be treated as transactional commercial data belonging to an order/order item.

Whenever AMIS CRM exposes the authoritative discount information, synchronize it from AMIS rather than asking the user to enter it again.

Do not hard-code 30% or 35% customer discount.

---

# 3. ECONOMIC MODEL

At OrderItem level:

Reference/List Value
× Management Pool Rate
= Management Pool

Then:

Residual Pool
=
Management Pool
- Customer Discount
- Marketing Support
- Dealer/Channel Incentive
- Sales/ASM/RSM Incentive
- Other Eligible Selling Costs
- Reserve

Residual Pool is subsequently allocated according to a versioned Bonus Policy.

Example current allocation:

PM = 35%
Support = 30%
Company = 35%

These percentages are configuration, not constants.

---

# 4. SEPARATE FINANCIAL CONCEPTS

The system MUST distinguish:

Gross/List Value

Customer Discount

Net Sales Value

Collected Amount

Outstanding Amount

Management Pool

Residual Pool

Calculated Bonus

Earned Bonus

Payable Bonus

Never collapse these concepts into a generic "revenue" variable.

---

# 5. SYSTEM BOUNDARIES

AMIS CRM remains the operational CRM.

This application must NOT attempt to replace AMIS CRM.

AMIS is expected to provide, subject to actual API discovery:

Customer

Order

Order Items

Product

Salesperson / PM

Commercial pricing

Discount information

Order status

The Commission application owns:

confirmed payment records

Management Pool policies

bonus policies

employee mappings

targets

manual eligible expenses

calculations

settlements

adjustments

audit logs.

---

# 6. AMIS INTEGRATION — MANDATORY DISCOVERY FIRST

Before implementing the AMIS adapter:

Read the official AMIS CRM API v2 documentation.

Perform an API discovery spike.

Do NOT invent endpoint names.

Do NOT invent JSON field names.

Do NOT assume discount, price, owner, or product schemas.

Create:

docs/integrations/amis-api-discovery.md

and:

docs/integrations/amis-field-mapping.md

The field mapping document must contain:

AMIS endpoint

AMIS JSON path

Internal canonical field

Datatype

Nullable

Example value

Transformation rule

Synchronization direction.

Minimum concepts to discover:

Order ID
Order Number
Order Date
Customer ID
Customer Name
Owner ID
Owner Name
Product ID
SKU
Product Name
Quantity
Reference/List Price
Selling Price
Discount Rate
Discount Amount
Net Value
Order Status
Created At
Updated At.

If required data is unavailable from the API, explicitly document:

AMIS FIELD GAP

and design a configurable mapping/custom-field fallback.

Never fabricate data.

---

# 7. ANTI-CORRUPTION LAYER

AMIS-specific schemas must NOT leak into the business domain.

Architecture:

AMIS API
→ AmisClient
→ AmisAdapter
→ Canonical Domain Model
→ Application Services

Business calculation code must never directly depend on AMIS JSON structures.

---

# 8. SYNC ARCHITECTURE

Use hybrid synchronization:

Webhook
+
Scheduled reconciliation.

Webhook provides low-latency synchronization.

Scheduled reconciliation repairs missed webhook events and synchronization drift.

All synchronization must be idempotent.

Use a unique source key similar to:

(source_system, external_entity_id)

Repeated synchronization must never duplicate entities.

---

# 9. DOMAIN MODEL

Implement explicit domain entities at minimum:

Employee

Customer

Product

Order

OrderItem

Payment

PaymentAllocation

ManagementPoolPolicy

BonusPolicy

PoolExpense

EmployeeTarget

CalculationPeriod

BonusCalculation

BonusCalculationLine

Settlement

Adjustment

AuditLog

ExternalEntityMapping.

Avoid giant generic tables.

---

# 10. PRODUCT

Product must support:

internal ID

AMIS external ID

SKU

name

product group

active status.

Products may have different Management Pool policies.

---

# 11. MANAGEMENT POOL POLICY

Implement a versioned policy model.

Policy scopes:

ALL

PRODUCT_GROUP

PRODUCT.

Resolution precedence:

PRODUCT
>
PRODUCT_GROUP
>
ALL.

Policy contains:

version

scope

pool rate

effective_from

effective_to

status

created_by

approved_by.

Do not modify historical policies that have already affected locked settlements.

Create new policy versions.

---

# 12. ORDER ITEM POLICY SNAPSHOT

At order synchronization/finalization, resolve the applicable Management Pool policy and snapshot:

management_pool_rate

policy_id

policy_version

effective context.

Historical orders MUST NOT change when a future policy changes.

Example:

Order date:
2026-09-15

Pool rate:
45%

New policy starting:
2026-11-01 = 40%

Customer pays:
2026-12-10

The order must continue using 45%.

---

# 13. PAYMENT MODEL

Do NOT model payment as:

order.paid = true.

An Order has zero or many Payment transactions.

Payment fields include:

amount

payment date

payment method

reference number

note

status

created by

confirmed by

confirmed at.

Statuses:

DRAFT

CONFIRMED

REVERSED.

Only CONFIRMED economic amounts participate in earned incentive calculations.

---

# 14. PARTIAL PAYMENT

Partial payments are first-class behavior.

Example:

Order Net Value = 100m

Payment September = 70m

Payment October = 30m.

September calculations must recognize only the September economic portion.

October recognizes the remaining portion.

Never double count.

---

# 15. PAYMENT ALLOCATION

Payments belong to Orders but must be allocatable to OrderItems.

Default V1 allocation:

PRO_RATA_BY_NET_VALUE.

Example:

Product A net = 60m

Product B net = 40m

Payment = 50m

Allocation:

A = 30m

B = 20m.

Allow authorized manual override.

Invariant:

sum(PaymentAllocation.amount)
=
Payment.amount.

Handle rounding deterministically.

---

# 16. POOL EXPENSE MODEL

Use extensible PoolExpense records rather than hard-coded database columns.

Expense categories initially include:

CUSTOMER_DISCOUNT

MARKETING_SUPPORT

DEALER_INCENTIVE

SALES_INCENTIVE

OTHER

RESERVE.

Each expense must record:

amount

source

order/order item association

evidence/reference if applicable

creator

approval state

timestamps.

Do not double-count customer discount if it is already represented authoritatively in OrderItem pricing.

Establish exactly one authoritative representation used by the calculation engine.

---

# 17. CALCULATION ENGINE

Build calculation logic as a pure, deterministic domain module.

It must NOT depend directly on:

UI

AMIS API

database queries

HTTP requests.

Given the same immutable inputs, it must always produce the same outputs.

Support:

multiple products

different Management Pool rates

different customer discounts

partial payments

multiple payments

payment reversals

refunds

expenses

policy changes

historical snapshots

adjustments.

Use Decimal or integer-based money arithmetic.

NEVER use binary floating point for financial calculations.

---

# 18. BONUS POLICY

Residual Pool allocation must be versioned.

Example:

PM 35%

Support 30%

Company 35%.

Validation:

PM + Support + Company = 100%.

Do not hard-code these percentages.

---

# 19. PM TARGET

Employee targets are period-specific records.

Initial target type:

COLLECTED_REVENUE.

Achievement:

confirmed collected revenue / target.

Existing business rule:

when target is reached,
PM bonus becomes payable.

When target is not reached:

Calculated Bonus remains visible.

Earned Bonus remains traceable.

Payable Bonus may be zero according to policy.

Do NOT erase calculated bonus.

Do NOT invent tiered incentive logic unless later specified.

---

# 20. SUPPORT POOL

First calculate the total Support Pool.

Keep distribution strategy extensible.

Supported strategies should be designed for:

EQUAL

FIXED_PERCENT

WEIGHTED

MANUAL.

Do not over-engineer the first UI.

The initial requirement is accurate Support Pool calculation and traceability.

---

# 21. PERIOD STATE MACHINE

Implement:

OPEN
→ REVIEW
→ LOCKED
→ PAID.

OPEN:

sync and calculations may change.

REVIEW:

accounting performs reconciliation.

LOCKED:

create immutable settlement snapshots.

PAID:

mark settlement as paid.

Locked financial history must never be silently rewritten.

---

# 22. ADJUSTMENTS

Corrections after period lock must use Adjustment records.

Do not modify locked history.

An Adjustment records at minimum:

source period

application period

amount

reason

related entity

created by

approved by

timestamps.

---

# 23. SECURITY

Implement server-side RBAC.

Roles:

ADMIN

ACCOUNTING

PM

SALES_MANAGER

SUPPORT_MANAGER

EXECUTIVE

AUDITOR.

Never rely only on frontend authorization.

PM can view their own commercial and incentive information.

PM cannot:

change Management Pool policies

confirm payments

change locked settlements

directly alter calculated bonuses.

Accounting manages payment reconciliation and settlement workflow.

Authorized management controls policies.

Auditor is read-only.

---

# 24. SECRET MANAGEMENT

AMIS client_secret and tokens must exist server-side only.

Never expose them to the browser.

Never commit credentials.

Never write raw secrets into logs.

Redact sensitive authentication information.

---

# 25. AUDIT LOG

Audit all financially relevant actions.

At minimum:

policy creation/change

discount changes received from source

payment creation

payment confirmation

payment reversal

expense changes

target changes

settlement locking

adjustments

employee mappings

AMIS field mappings.

Audit log must capture:

actor

timestamp

action

entity

before state

after state

reason when applicable.

Audit records must not be editable through normal UI.

---

# 26. EXPLAINABLE CALCULATIONS

Every bonus result must be explainable.

Provide an endpoint and UI action:

"Xem cách tính"

It must show the complete calculation chain from:

Order / Product

→ Gross Value

→ Discount

→ Net Sales

→ Collected allocation

→ Management Pool Rate

→ Management Pool

→ Expenses

→ Residual Pool

→ PM / Support / Company allocation

→ target condition

→ payable amount.

A financial result that cannot be explained is considered incorrect.

---

# 27. USER INTERFACE

Use the approved dashboard concept as visual direction.

Primary navigation:

Tổng quan

Đơn hàng

Đối soát thu tiền

Tính thưởng

Báo cáo

Nhân sự

Chính sách thưởng

Kết nối AMIS CRM

Hệ thống.

Primary accounting workflow:

Đối soát thu tiền.

The user must be able to find an order and record/confirm payment with minimal steps.

---

# 28. DASHBOARD

Display at minimum:

Sales value

Confirmed collected amount

Collection rate

Outstanding amount

Calculated PM bonus

Payable PM bonus

Support pool

Company residual share.

Allow period filtering.

Prioritize cash collection over vanity revenue metrics.

---

# 29. GOLDEN DATASET

The supplied Excel workbook contains historical business calculations.

Treat it as reference material, NOT unquestionable truth.

Extract historical cases.

Identify anomalies.

Document them.

Create an approved normalized Golden Dataset.

Then implement regression tests.

Historical sheets should include, where usable:

2603
2604
2605
2606
2607
2608
2609.

Do not blindly reproduce suspicious spreadsheet formulas.

---

# 30. TESTING REQUIREMENTS

Create unit tests for:

Management Pool policy resolution

historical policy snapshot

customer discount

Residual Pool calculation

partial payment

payment allocation

multiple products

rounding

payment reversal

target qualification

bonus allocation

locked settlement

adjustments.

Create integration tests for:

AMIS adapter

sync idempotency

webhook processing

scheduled reconciliation

payment confirmation

settlement workflow.

Create end-to-end tests for the primary accounting flow.

---

# 31. CRITICAL ACCEPTANCE TESTS

Test different product rates:

A = 45%
B = 50%.

Test policy history:

old order remains at old rate after new policy begins.

Test PM discount autonomy:

same product,
different discount,
different residual result.

Test multi-product partial payment.

Test repeated AMIS synchronization produces no duplicates.

Test confirmed vs draft payment.

Test reversal.

Test locked period immutability.

Test explain-calculation totals reconcile exactly.

Test Golden Dataset against approved historical values.

Money comparisons must be exact according to the defined rounding policy.

---

# 32. IMPLEMENTATION PHASES

Do not build everything simultaneously.

## PHASE 0 — Discovery

Inspect repository/environment.

Analyze workbook.

Analyze AMIS API.

Produce:

architecture.md

domain-model.md

calculation-spec.md

amis-api-discovery.md

amis-field-mapping.md

security-model.md

test-plan.md.

Do not implement production features until major domain ambiguities are documented.

## PHASE 1 — Domain Foundation

Implement:

database schema

domain entities

money primitives

Management Pool policies

Bonus policies

calculation engine.

Build unit tests first.

Checkpoint commit.

## PHASE 2 — Historical Validation

Extract and normalize Golden Dataset.

Run calculation engine against historical cases.

Resolve discrepancies.

Do not continue until core calculation behavior is trusted.

Checkpoint commit.

## PHASE 3 — AMIS Integration

Implement:

authentication

AmisClient

adapter

field mapping

order sync

product sync

customer sync

employee/owner mapping

webhook

scheduled reconciliation

idempotency.

Checkpoint commit.

## PHASE 4 — Payments

Implement:

payment reconciliation

partial payments

payment allocation

confirmation

reversal

audit.

Checkpoint commit.

## PHASE 5 — Bonus & Settlement

Implement:

targets

bonus calculations

support pool

period workflow

locking

snapshots

adjustments.

Checkpoint commit.

## PHASE 6 — UI

Implement approved application UI.

Prioritize:

payment reconciliation

bonus results

calculation explanation

policy management

AMIS connection health.

Checkpoint commit.

## PHASE 7 — Security & Hardening

RBAC

secret management

validation

audit verification

error handling

rate-limit/retry handling

backup/migration review.

Checkpoint commit.

## PHASE 8 — Production Closure

Run:

unit tests

integration tests

E2E tests

Golden Dataset regression

security checks

build/lint/typecheck

migration verification.

Produce:

PRODUCTION_READINESS.md.

---

# 33. STOP CONDITIONS

Stop and request business clarification instead of guessing if any of these are ambiguous:

authoritative AMIS discount representation

reference/list price definition

whether Management Pool is based on gross/list value or another economic base

refund treatment

discount exceeding Management Pool

negative Residual Pool

expense approval rules

support-pool individual allocation

rounding policy with material financial impact.

Document the ambiguity and propose alternatives.

Never silently choose a financially consequential interpretation.

---

# 34. ENGINEERING PRINCIPLES

Financial correctness > convenience.

Domain rules > UI shortcuts.

Immutable history > recalculating history with current configuration.

Configuration > hard-coded percentages.

Canonical domain > AMIS-specific schemas.

Transactions > boolean paid flags.

Explainability > black-box calculations.

Auditability > destructive edits.

Tests > assumptions.

---

# 35. DEFINITION OF DONE

The system is NOT done merely because screens render.

Production-ready means:

AMIS synchronization works reliably.

No duplicate orders are produced by repeated synchronization.

Product-level Management Pool policies work.

Historical policy snapshots work.

PM-specific customer discounts are respected.

Partial payments calculate correctly.

Multi-product payments allocate correctly.

Bonus calculations are deterministic.

Accounting can reconcile collections.

Every bonus is explainable.

Periods can be safely locked.

Historical settlements cannot silently change.

Adjustments are auditable.

RBAC is enforced server-side.

Secrets remain server-side.

Golden Dataset tests pass.

All critical automated tests pass.

Production readiness documentation is complete.

Only then mark:

PRODUCTION READY.