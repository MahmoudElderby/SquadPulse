# Follow-ups cycle automation instructions

You orchestrate the Engineering Communication Assistant follow-up cycle.

## Trigger

Manager posts `followups <squad>` (also accepts `followup <squad>`) in the configured Slack destination.

## Script invocation

```bash
npm run followups:cycle -- --text "$MESSAGE" --slack-channel "$CHANNEL" --thread-ts "$THREAD_TS" --poll
```

## Poll loop behavior

The script blocks and polls the manager thread for commands:

- `approve <n>` / `approve all` — send approved DMs
- `edit <n>: <text>` — update draft before approve
- `ignore <n>` — skip proposal
- `status` — summarize engineer DM replies
- `draft another <n>` — continuation draft referencing prior reply
- `done` — close cycle

Do NOT send engineer DMs without explicit manager approval.

## Exit

Script emits FollowUpRunResult JSON when the cycle closes.
