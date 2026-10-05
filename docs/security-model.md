# Security model — Phase 0

Server authentication validates identity; no client-selected role or actor header is trusted. Tenant and row-level authorization applies to API, exports, explanation, background services and direct database access. Role assignment and business approval delegation are separate from UI visibility.

| Role | Proposed access |
|---|---|
| ADMIN | System/user/integration configuration; approve expenses and adjustments; policies through approved workflow; cannot rewrite locked settlements or audit |
| ACCOUNTING | Reconcile/create/confirm/reverse payments, manual allocation, period review/lock/payout under approved permissions |
| PM | Read own orders, pricing, calculated/earned/payable and own explanations; cannot change policies/confirm payment/edit bonus/locked history |
| SALES_MANAGER | Scoped commercial/target review; policy/expense approval only if explicitly delegated |
| SUPPORT_MANAGER | Support pool and recipient allocation review; distribution changes subject to B07/B05 |
| EXECUTIVE | Director authority approves expenses and adjustments; aggregates and scoped management actions; no locked-history rewrite |
| AUDITOR | Read-only audit/financial snapshots; no financial mutations |

PM ownership is checked on each resource lookup, including indirect item/payment/explanation IDs. Manager organizational scope and auditors' tenant boundaries are enforced similarly. Unauthorized resource enumeration must not expose other PM results. UI affordances reflect server capability but never grant it.

## Secret and integration controls

AMIS credentials/tokens exist only in server secret storage; browser bundle, HTTP responses, audit before/after snapshots, exception traces, request logs and fixtures must never contain them. Ignore `.env*` except placeholder examples, raw tenant payloads, bank evidence, workbook originals and generated outputs in Git. Mask Authorization, Clientid as necessary, client_secret, tokens and personal/banking data in logs. Secret scanning and compiled-bundle inspection required before release.

Webhook authenticity is unresolved. Validate documented protocol only; callbacks must not mutate finance based on unsigned payloads. Body size limits, replay protection where evidence supports it, rate limits and authenticated source refetch protect intake. Provider endpoints are pinned/allowlisted; configurable field mappings cannot execute code or arbitrary URLs.

## Audit and approval

Log policy versions/approvals, source discount changes, payment drafts/confirmations/reversals, expenses, targets, locking/payouts, adjustments, employee mappings and field-mapping versions. Capture actor/time/action/entity/redacted before/after/reason/correlation ID in the same transaction. Normal API/database roles cannot update/delete logs. Administrative recovery has separate restricted credentials and independently retained audit evidence.

Require stale-version checks, idempotency keys and transactional concurrency controls for money actions. User approves Director/Admin authority for expenses and adjustments; other target/override approval details remain pending. Maker/checker is not silently made a business requirement. No role may mutate locked calculation facts. Audit list-price/VAT-basis/support-policy changes, negative-pool warnings, refund recovery approvals and shown rounding deltas.

## Release controls

Session expiration/revocation, CSRF controls if cookie-authenticated, secure cookies/TLS, schema validation, parameterized queries, dependency/security scan, authorization integration/E2E tests, encrypted backups, verified restore, tested migrations, redacted operational alerts and retention/access policy. Identity provider/hosting/retention periods remain deployment decisions.

## Local application checkpoint — 2026-10-06

The independent manual-entry application is implemented and tested. Current behavior, role boundaries, configuration choices, validation evidence and external gates are recorded in [README](../README.md), [self-review](self-review.md) and [production readiness](../PRODUCTION_READINESS.md). Earlier architecture/phase proposals do not imply that AMIS or historical sources have been verified. Local configuration explicitly selects VAT basis, recognition/expense timing and order-date snapshots; no example policy rates are activated silently.
