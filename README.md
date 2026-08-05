# SquadPulse — Engineering Manager Copilot

Cursor-only assistant for engineering managers: read-only Jira analysis and Slack reports for two configurable squads.

## Quick start

```bash
npm install
npm run config:validate
npm test
npm run analyze:on-demand -- --text "analyze Storefront squad" --fixture
```

## Configuration

1. Copy `config/em-copilot.example.yml` → `config/em-copilot.yml` (optional local; gitignored).
2. Set Cloud Agent / Automation secrets (never commit):

   - `JIRA_BASE_URL`
   - `JIRA_EMAIL`
   - `JIRA_API_TOKEN`
   - `SLACK_BOT_TOKEN`

## Docs

- [Operator overview](docs/em-copilot.md)
- [On-demand Slack automation](docs/automations/on-demand-slack.md)
- [Daily briefing automation](docs/automations/daily-briefing.md)
- [Spec / quickstart](specs/001-em-copilot/quickstart.md)

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run config:validate` | Validate config offline |
| `npm run analyze:on-demand` | Single-squad analysis (Slack text) |
| `npm run analyze:daily` | Two-squad daily briefing |
| `npm run analyze:fixture` | Deterministic rules on fixtures |
| `npm test` | Vitest suite |
