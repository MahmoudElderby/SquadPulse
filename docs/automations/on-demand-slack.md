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

1. Post `analyze Storefront squad` (or your configured squad, e.g. Orion / Cobra)
2. Verify threaded reply with health, risks, blockers, titles/owners
3. Post `analyze Growth squad` → validation error listing configured squads
4. Optional scopes (portable focus — same model for future Jira prompts):
   - `analyze Orion tickets focus on Mohamed Mostafa tickets`
   - `analyze Orion MTN-11155`
   - `show blockers for Cobra assignee: Sara`

## Request model

Every free-text / structured request resolves to:

| Field | Meaning |
|-------|---------|
| **squad** | Which board/filter baseline |
| **intent** | full / blockers / stale / hygiene / sprint / follow-up |
| **scope** (optional) | Narrow after fetch: issue keys, assignees, labels |

Empty scope = whole squad. Dimensions combine with **AND**.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| No reply | Automation enabled; bot in channel; `SLACK_BOT_TOKEN` set |
| `JIRA_AUTH_FAILED` | Token permissions; `JIRA_BASE_URL` matches config |
| Unknown squad | Squad name/alias in `config/em-copilot.yml` |
| Scope returns 0 issues | Name must match Jira display name; key must be in squad fetch window |
