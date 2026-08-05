# On-Demand Automation Instructions

When a Slack message triggers this automation:

1. Read the message text from the trigger payload (`$MESSAGE` or equivalent).
2. Run from repository root:

```bash
npm run analyze:on-demand -- --text "<message text>" --slack-channel $CHANNEL --thread-ts $THREAD_TS
```

3. For offline smoke testing:

```bash
npm run analyze:on-demand -- --text "analyze Storefront squad" --fixture
```

4. Inspect stdout for `RunResult` JSON:
   - `status: success` — report posted
   - `failureReason: UNKNOWN_SQUAD` — validation reply sent
   - `failureReason: JIRA_AUTH_FAILED` — no analysis performed

5. Do **not** send follow-up drafts to team members — manager thread only.

## Supported intents

`full`, `sprint`, `blockers`, `stale`, `hygiene`, `follow-up`

Intent is parsed from keywords in the message (see `src/slack/parse-request.ts`).
