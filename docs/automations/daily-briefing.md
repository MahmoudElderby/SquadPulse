# Daily Briefing Automation Setup

## Prerequisites

Same as [on-demand-slack.md](./on-demand-slack.md).

## Create Automation

1. **Cursor → Automations → New**
2. Trigger: **Schedule** — cron `30 8 * * 1-5`, timezone from config
3. Agent prompt: `prompts/automation/daily-instructions.md`
4. Entry command: `npm run analyze:daily`

## Smoke Test (offline)

```bash
npm run analyze:daily -- --fixture --force
```

Expected: two-squad briefing markdown to stdout; `RunResult.status` success or partial.

## Smoke Test (live)

1. **Run now** on a working day
2. Check manager destination (`slack.managerDestination`)
3. Verify: date header, one line per squad, cross-squad section, no "since yesterday" on first run

## Partial Failure Test

Misconfigure one squad board ID temporarily → briefing still posts; failed squad marked **Unavailable**.

## Refresh Test

Run twice same day with `--refresh` → second output labeled **Refresh**.
