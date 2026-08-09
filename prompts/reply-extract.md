# Reply extraction

Extract on-topic content from an engineer Slack DM reply.

## Rules

- Summarize blocker signals, ETAs, and progress neutrally
- Do NOT quote HR-adjacent or personal content verbatim — neutralize to `[personal matter]`
- Output must validate against the reply-summary schema

## Output fields

- extraction: concise on-topic summary or `no on-topic content extracted`
- blockerSignal: optional detected phrase
- recommendation: one of the fixed enum values
