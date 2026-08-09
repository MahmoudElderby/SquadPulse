# Follow-ups Slack Automation

Cursor Automation setup for the Engineering Communication Assistant follow-up cycle.

## Trigger

- **Type**: `slackTrigger`
- **Destination**: `slack.managerDestination` from `config/em-copilot.yml`
- **Filter**: message contains `followups`, `follow-ups`, or `follow ups`

Do **not** trigger on bare `approve`, `status`, or `done` — those are handled inside the blocking poll loop.

## Script

```bash
npm run followups:cycle -- --text "$MESSAGE" --slack-channel "$CHANNEL" --thread-ts "$THREAD_TS" --poll
```

## Agent instructions

Use `prompts/automation/followups-instructions.md`.

## Required Slack bot scopes

In addition to feature 001 scopes:

| Scope | Purpose |
|-------|---------|
| `chat:write` | Post preview and summaries to manager thread |
| `im:write` | Open DM channels and send engineer messages |
| `im:history` | Read engineer DM replies for `status` command |
| `im:read` | List/open DM channels (recommended with `im:history`) |
| `users:read` | Validate Slack user mappings |

## Engineer can reply to follow-up DMs

If an engineer sees **“Squad Pulse is turned off”** (or cannot type in the bot DM), the Slack **App Home** must allow incoming messages. This is configured in the Slack API dashboard — not in `config/em-copilot.yml`.

### Slack app admin steps

1. Open [api.slack.com/apps](https://api.slack.com/apps) → select **Squad Pulse** (your bot app).
2. Go to **Features → App Home**.
3. Turn on **Messages Tab**.
4. Turn on **Allow users to send Slash commands and messages from the messages tab**.
5. If you added scopes (`im:read`, etc.), go to **Install App → Reinstall to Workspace** and approve the new permissions.
6. Ask the engineer to open **Apps → Squad Pulse** once and confirm the message input is enabled in the DM.

### Engineer-side check

- Reply **in the DM thread** Squad Pulse opened (not in a manager channel).
- If the app was paused/disabled for that user: **Apps → Squad Pulse →** ensure notifications/messages are not blocked.
- Workspace admins: confirm no policy blocks **user-to-app DMs**.

Until App Home messaging is enabled, delivery can succeed but **`status` will show no replies** because the bot cannot receive engineer messages.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Engineer cannot reply; “app is turned off” | App Home → Messages Tab + allow user messages (above) |
| `status` shows no replies | Engineer replied in bot DM; `im:history` scope; bot not blocked |
| No reply | Automation enabled; bot in channel; `SLACK_BOT_TOKEN` set |

## Blocking run

The poll loop runs up to `communicationAssistant.cycleMaxMinutes` (default 60). Ensure the Cursor Cloud Agent run timeout accommodates this.

## Prerequisites

1. Valid `config/em-copilot.yml` with `teamMemberSlackMap` per squad
2. Recent SquadAnalysisArtifact at `.squadpulse/analysis/{squadId}-latest.json` (from `analyze:on-demand` or `analyze:daily`)

## Offline validation

```bash
npm run followups:cycle -- --text "followups Orion" --fixture --dry-run --config fixtures/config/followups-orion.yml
```
