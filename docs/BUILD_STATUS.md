# Build checkpoint

**LOCAL APPLICATION COMPLETE; EXTERNAL PRODUCTION GATES OPEN.** Latest user authorized autonomous build, test and self-review. Workspace `/Users/tranhaibang/.gemini/antigravity-ide/scratch/xtools/sales-bonus`.

## Latest user guide checkpoint · 2026-10-06

Added first-Admin setup sequence, a nine-topic ordered sidebar guide, and page-aware help on each operating page. The selected topic is addressable in the hash route and links back to its function. Usability E2E covered all nine help mappings/topics and mobile navigation. A real 375px overflow was found in the long next-topic control and fixed; desktop/mobile screenshots were reviewed. Browser E2E passed after the fix; `npm run lint`, build, full `npm run check` (27/27) and `git diff --check` passed. This guide checkpoint is part of the current application source; use Git history for its commit.

## Implemented

apps/server: persisted PGlite/PostgreSQL, session authentication, server RBAC, explicit immutable configuration, versioned prices and product/group/global policies, manual finalized orders, target versions, cash-conserving receipts/confirm/manual allocation/reversal, expense approval/refusal, exact period calculations, chronological review/lock/pay, immutable history, reviewed post-lock refund recovery/offset, audit and authenticated backup.

apps/web: Vietnamese9-page application, accounting workflow, calculation explanation, policy/group/price management, periods/targets/staff, approval/refusal/offset controls, JSON report export, backup download and responsive mobile layout. No default credentials or operating fake records.

User rules: editable per-product prices sourced provisionally from PDF; revenue before VAT configurable; discount-over-pool warning; negative pool bonus0 with reason/raw loss; refunds recover already received bonus without rewriting history; Director/Admin approval; initial Support60:20:20; ceiling final **net person/department total** to1,000 VND with separate difference. Other financial choices require explicit UI configuration.

## Validation evidence

27 domain/SQL/HTTP tests passed, 46 exact source-price/VAT checks passed, Chrome E2E passed through full local lifecycle plus all9 pages/groups/backup/mobile. Persistent DB reopen and actual CLI backup restore passed. Final lint/typecheck/build pass; npm audit0 vulnerabilities; git diff --check clean. Tests and source checks passed after final rounding correction; Chrome E2E rerun also passed. Local server is running at http://127.0.0.1:4317 and the deliverable browser shows first Admin setup. The application checkpoint is committed after checks; Git log is authoritative. Tests never connect to production or AMIS.

## Resume instructions

Read this checkpoint, Git status/log, README, PRODUCTION_READINESS.md and docs/self-review.md first. Preserve existing user edits. If a working tree from this build is still uncommitted, verify outstanding checks and finish one coherent application checkpoint commit. Start the local server at port4317 if needed; show it in Codex. Do not seed QA accounts/orders into `.runtime/database`.

If the implementation is committed and check results still match current inputs, no repeated build is needed. A scheduled follow-up may finish outstanding review or repair a concrete failure. Stay quiet if nothing actionable changed; notify only a meaningful failure, required external input change or completion. Do not claim AMIS/historical regression/production done. No deploy/push/credit reset authorized.

## External gates

AMIS tenant access/redacted payloads and verified identities/discount/list/VAT/owner/webhook mapping absent. Historical workbook sheets2603–2609 absent. Dashboard reference absent. Never fabricate fields, credentials, historical cases or approvals. Independent local implementation is authorized despite these missing inputs; production integration depends on real evidence.

## Scheduling

User requested same-chat continuation attempts at23:55 Oct5 and05:00 Oct6, Asia/Tokyo; native automation IDs `ti-p-t-c-sales-bonus-23-55`, `ti-p-t-c-sales-bonus-05-00`. `scripts/resume-build.mjs` reads checkpoint and checks changed source fingerprints. It does not launch models or reset limits. Keep machine awake/app running for scheduled local work. No OS cron or detached competing build writer installed.
