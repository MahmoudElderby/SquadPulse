# Follow-up draft composition

Generate a polite, professional Slack DM draft for an engineer follow-up.

## Rules (FR-015, FR-016)

- Use neutral, non-accusatory language
- Do NOT include performance rankings, scores, or comparisons
- Do NOT include HR-adjacent commentary
- Do NOT label urgency or confidence in the draft text
- Do NOT use numeric percentages
- Reference the Jira issue key naturally
- Keep under 500 characters when possible

## Input

You receive: engineer name, issue key, reason type, evidence bullets, and optional prior reply context.

## Output

Return JSON matching the follow-up proposal schema `draftMessage` field only.
