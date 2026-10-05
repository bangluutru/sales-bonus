# Scheduled build continuation

User authorized build and two resumption attempts after account-limit reset.

## Schedule — Asia/Tokyo

- 2026-10-05 23:55: automation `ti-p-t-c-sales-bonus-23-55`.
- 2026-10-06 05:00: automation `ti-p-t-c-sales-bonus-05-00`.

Both are active thread automations with one occurrence, returning to this same chat. Their persisted prompts include project path, rules, checkpoint, phase gates, test/commit behavior and no duplicate implementation. No additional daily recurrence was requested or installed.

The read-only account check at setup reported 43% used in the 5-hour window (57% remaining), 48% used in the weekly window, and next short-window reset at 2026-10-05 23:51:07 Asia/Tokyo. Availability may change with shared account usage. A schedule does not reset limits or guarantee the next window remains available.

## Script and checkpoint

`node scripts/resume-build.mjs --status-only` reads `docs/BUILD_STATUS.md`.
`node scripts/resume-build.mjs` checks source fingerprints and runs `npm run check` if inputs differ from the last passing check. Saves ignored `.runtime/last-resume-check.json`. On missing dependencies, reports `npm ci` instead of silently installing. A failing check exits nonzero for the continuing agent to repair.

The script **does not launch another agent, bypass limits or itself generate source code**. Native app scheduling starts the continuing agent with this chat context. The agent reads checkpoint, resumes unfinished authorized work and updates the checkpoint/commit. This avoids concurrent detached CLI writers.

Keep the Mac powered on/awake, the app running and workspace available; local scheduled work depends on those conditions. [Official scheduling documentation](https://learn.chatgpt.com/docs/automations?surface=app). No system sleep settings were changed and no OS cron/LaunchAgent installed.

If a run still lacks workbook/AMIS evidence or indispensable financial rules, it can continue independent foundation work but must not fabricate inputs, skip required gates or report production ready. Both schedules can be reviewed in the app's Scheduled view.
