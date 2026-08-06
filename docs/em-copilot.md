# Engineering Manager Copilot — Operator Overview

Cursor-only assistant for engineering managers: Jira read + Slack reports for two configurable squads.

## Quick Commands

| Command | Purpose |
|---------|---------|
| `npm run config:validate` | Validate YAML config offline |
| `npm test` | Run Vitest unit/integration tests |
| `npm run analyze:fixture -- --squad storefront --intent full` | Offline squad analysis |
| `npm run analyze:on-demand -- --text "..." --fixture` | Offline on-demand path |
| `npm run analyze:daily -- --fixture --force` | Offline daily briefing |
| `npm run validate:contextual -- --file fixtures/ai/sample-contextual-analysis.json` | Validate AI JSON schema |

## Configuration

- Example: `config/em-copilot.example.yml`
- Schema: `config/em-copilot.schema.json`
- Copy example to `config/em-copilot.yml` and customize squads, boards, thresholds

## Secrets (never commit)

- `JIRA_BASE_URL` — full site origin only, **with `https://`**, e.g. `https://paysky1.atlassian.net`  
  (not a bare hostname, not a board browser URL)
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `SLACK_BOT_TOKEN`

Override env var names in config `secrets.envVarNames`.

### Not using Jira MCP

The MVP talks to Jira via **REST** (`/rest/api/3/*` and `/rest/agile/1.0/*`) from Node CLIs.  
Cursor’s Atlassian/Jira MCP is optional for human-agent chats; automations do **not** require it and the analysis engine is not built on MCP today.

## Automations

- [On-demand Slack](./automations/on-demand-slack.md)
- [Daily briefing](./automations/daily-briefing.md)

## Architecture

```
Config → Jira fetch (or fixture) → Normalize → Deterministic rules → Optional AI contextual → Render → Slack
```

Health classification is **deterministic only**. Follow-up drafts are **manager-reviewed**, never auto-sent to team members.

## Troubleshooting

| RunResult code | Meaning |
|----------------|---------|
| `CONFIG_INVALID` | Fix config before any API calls |
| `JIRA_AUTH_FAILED` | Check Jira credentials |
| `SLACK_POST_FAILED` | Analysis succeeded; Slack post failed |
| `UNKNOWN_SQUAD` | User message didn't match configured squads |

See [quickstart](../specs/001-em-copilot/quickstart.md) for full validation scenarios.
