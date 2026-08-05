# Daily Briefing Automation Instructions

When the schedule trigger fires on a configured working day:

1. Run from repository root:

```bash
npm run analyze:daily
```

2. For offline smoke testing:

```bash
npm run analyze:daily -- --fixture --force
```

3. Same-day refresh (manual re-run):

```bash
npm run analyze:daily -- --fixture --force --refresh
```

4. Inspect stdout `RunResult`:
   - `status: success` or `partial` — briefing delivered
   - `squadsFailed` — partial squad failure (FR-019)
   - `isRefresh: true` — second same-day run

5. Post goes to `slack.managerDestination` from config only — never team DMs.

## Schedule

Default: Mon–Fri 08:30 in configured timezone (`config/em-copilot.example.yml`).

Cursor Automation cron suggestion: `30 8 * * 1-5` with timezone set in automation UI.
