# Quickstart: Engineering Manager Copilot (MVP)

**Feature**: `001-em-copilot`  
**Purpose**: Runnable validation scenarios proving end-to-end behavior without requiring full production setup for every check.

See also: [data-model.md](./data-model.md), [contracts/](./contracts/), [research.md](./research.md).

---

## Prerequisites

- **Node.js 20+** and npm
- **Cursor** workspace with Automations enabled
- **Jira Cloud** read-only API token for configured projects/boards
- **Slack** bot token with `chat:write` scoped to manager destination
- Secrets available to Cursor Automations / Agent runs:
  - `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `SLACK_BOT_TOKEN`

---

## 1. Install and validate configuration (offline)

```bash
npm install
npm run config:validate
```

**Expected**: Exit 0 with message confirming two squads, non-overlapping aliases, and at least one board per squad.

**Failure cases to verify** (SC-010):
- Remove a squad's board IDs → actionable error naming the squad
- Duplicate an alias across squads → validation error before any Jira call

---

## 2. Run deterministic rules against fixtures (offline)

```bash
npm test
```

**Expected**: All Vitest suites pass using anonymized fixtures in `fixtures/jira/`.

**Scenarios covered** (FR-046, SC-014):
- Stale in-progress beyond threshold → delivery risk
- Missing estimate only → hygiene finding, health stays `On Track`
- Three+ delivery risks → health `At Risk`
- Unowned P0/P1 blocker → health `At Risk`
- WIP overload per person → flow signal (neutral wording)

```bash
npm run analyze:fixture -- --squad storefront --intent full
```

**Expected**: JSON `DeterministicFindings` printed to stdout matching [deterministic-findings.schema.json](./contracts/deterministic-findings.schema.json).

---

## 3. Validate AI output schema (offline)

```bash
npm run validate:contextual -- --file fixtures/ai/sample-contextual-analysis.json
```

**Expected**: Exit 0 when sample conforms to [contextual-analysis.schema.json](./contracts/contextual-analysis.schema.json).

**Negative test**: Remove `issueKeys` from a draft → exit non-zero with schema error (FR-047).

---

## 4. On-demand squad analysis (live smoke)

**Setup**: Configure Cursor Automation with `slackTrigger` on manager channel; prompt invokes:

```bash
npm run analyze:on-demand -- --text "analyze Storefront squad" --slack-channel $CHANNEL --thread-ts $THREAD_TS
```

**Steps**:
1. Post `analyze Storefront squad` in the configured Slack channel.
2. Wait for automation/agent completion.

**Expected** (User Story 1, SC-001):
- Slack reply in thread with all required sections (FR-014)
- Health classification with rationale
- Each risk includes issue key evidence and manager action
- Unknown squad name → validation message listing configured squads (SC-003)

**Intent variants to spot-check**:
- `show blockers for Payments` → blockers-focused report
- `analyze Growth squad` → unknown squad error, no fabricated analysis

---

## 5. Daily two-squad briefing (live smoke)

**Setup**: Cursor Automation with schedule trigger (default Mon–Fri 08:30 in configured timezone); prompt invokes:

```bash
npm run analyze:daily
```

**Steps**:
1. Trigger automation manually (Run now) on a configured working day.
2. Inspect manager Slack destination.

**Expected** (User Story 2, SC-004):
- Single private message with date, one-line per squad, cross-squad priorities, risks/blockers, stand-up focus, drafts, data limitations
- No "since yesterday" language on first run (FR-018)

**Partial failure test** (SC-005):
- Temporarily misconfigure one squad's board ID → briefing still delivered; failed squad marked unavailable.

**Refresh test** (FR-018):
- Run daily automation twice same day → second message labeled as refresh.

---

## 6. Follow-up drafts (fixture + live)

```bash
npm run analyze:fixture -- --squad payments --intent follow-up --include-drafts
```

**Expected** (User Story 3, SC-009):
- Drafts grouped by recipient
- Each draft cites issue key(s), neutral tone
- No Slack DM sent to team members

---

## 7. Failure handling checks

| Scenario | Command / action | Expected RunResult |
|----------|------------------|-------------------|
| Invalid Jira token | Run with bad `JIRA_API_TOKEN` | `status: error`, `failureReason: JIRA_AUTH_FAILED`, no analysis (SC-006) |
| Slack post failure | Revoke bot token after analysis | `slackDelivered: false`, `failureReason: SLACK_POST_FAILED` (FR-038) |
| Jira truncation | Fixture with >500 issues | `limitations` includes truncation bullet (FR-024) |

Inspect stdout JSON against [run-result.schema.json](./contracts/run-result.schema.json).

---

## 8. Cursor Automation artifacts

After implementation, verify these committed artifacts exist (FR-048):

- `config/em-copilot.example.yml`
- `prompts/contextual-analysis.md`
- `docs/automations/on-demand-slack.md`
- `docs/automations/daily-briefing.md`

Automations themselves are configured in Cursor UI referencing repo scripts; setup steps are documented in the files above.

---

## Success checklist

- [ ] Config validation catches invalid squads before Jira calls
- [ ] Deterministic tests pass offline with fixtures
- [ ] On-demand Slack request returns structured squad report
- [ ] Daily briefing covers both squads to manager destination only
- [ ] Follow-up drafts returned to manager only
- [ ] Failures surface machine-readable `RunResult` in run history
- [ ] No hosted backend, database, or persistent store introduced
