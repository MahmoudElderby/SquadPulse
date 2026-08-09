# Follow-ups Slack Automation

Cursor Automation setup for the Engineering Communication Assistant follow-up cycle.

## Trigger

- **Type**: `slackTrigger`
- **Destination**: `slack.managerDestination` from `config/em-copilot.yml`
- **Filter**: message contains `followups`, `follow-ups`, `follow ups`, `followup`, or `follow up`

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
| `channels:history` / `groups:history` | Poll manager thread for approve/edit/status/done |
| `im:write` | Open DM channels and send engineer messages |
| `im:history` | Read engineer DM replies for `status` command |
| `users:read` | Validate Slack user mappings |

If the bot cannot read channel history, the cycle CLI accepts `--commands-bridge <jsonl>` so an automation agent can append manager commands (one `{"text","ts"}` per line) while polling via a privileged Slack reader. Use `--no-preview` when resuming after the preview was already posted.

## Blocking run

The poll loop runs up to `communicationAssistant.cycleMaxMinutes` (default 60). Ensure the Cursor Cloud Agent run timeout accommodates this.

## Prerequisites

1. Valid `config/em-copilot.yml` with `teamMemberSlackMap` per squad
2. Recent SquadAnalysisArtifact at `.squadpulse/analysis/{squadId}-latest.json` (from `analyze:on-demand` or `analyze:daily`)

## Offline validation

```bash
npm run followups:cycle -- --text "followups Orion" --fixture --dry-run --config fixtures/config/followups-orion.yml
```
