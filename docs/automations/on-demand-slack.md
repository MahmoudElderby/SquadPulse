# On-Demand Slack Automation Setup

## Prerequisites

- Cursor workspace with Automations enabled
- Slack integration connected
- Repository secrets: `JIRA_*`, `SLACK_BOT_TOKEN`
- Valid config at `config/em-copilot.yml` (copy from `config/em-copilot.example.yml`)

## Create Automation

1. Open **Cursor → Automations → New**
2. Trigger: **Slack** (`slackTrigger`) on manager channel/DM
3. Action: Run agent with repo context
4. Agent prompt: include `prompts/automation/on-demand-instructions.md`
5. Pass trigger variables to npm script (`--text`, `--slack-channel`, `--thread-ts`)

## Smoke Test (offline)

```bash
npm install
npm run config:validate
npm run analyze:on-demand -- --text "analyze Storefront squad" --fixture
```

## Smoke Test (live)

1. Post `analyze Storefront squad` in configured Slack channel
2. Verify threaded reply with health, risks, blockers sections
3. Post `analyze Growth squad` → validation error listing configured squads

## Troubleshooting

| Symptom | Check |
|---------|-------|
| No reply | Automation enabled; bot in channel; `SLACK_BOT_TOKEN` set |
| `JIRA_AUTH_FAILED` | Token permissions; `JIRA_BASE_URL` matches config |
| Unknown squad | Squad name/alias in `config/em-copilot.yml` |
