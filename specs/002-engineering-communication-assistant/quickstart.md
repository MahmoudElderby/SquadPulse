# Quickstart: Engineering Communication Assistant (MVP)

**Feature**: `002-engineering-communication-assistant`  
**Purpose**: Runnable validation scenarios proving the follow-up cycle end-to-end without requiring full production setup for every check.

See also: [data-model.md](./data-model.md), [contracts/](./contracts/), [research.md](./research.md), [plan.md](./plan.md).

---

## Prerequisites

- **Node.js 20+** and npm
- **Feature 001** implemented with artifact writer (see plan slice 1)
- **Cursor** workspace with Automations enabled
- **Slack** bot token with scopes: `chat:write`, `im:write`, `im:history`, `users:read`
- Secrets: `JIRA_*` (for generating analysis artifacts), `SLACK_BOT_TOKEN`
- Valid `config/em-copilot.yml` with `teamMemberSlackMap` per squad

---

## 1. Install and validate configuration (offline)

```bash
npm install
npm run config:validate
```

**Expected**: Exit 0; optional `communicationAssistant` block accepted when present.

**Verify new keys** (FR-009, FR-019):

```yaml
communicationAssistant:
  analysisFreshnessHours: 24
  maxProposalsPerCycle: 10
```

---

## 2. Seed analysis artifact (offline)

After 001 artifact writer is implemented, or manually copy a fixture:

```bash
mkdir -p .squadpulse/analysis
cp fixtures/analysis/orion-mixed-findings.json .squadpulse/analysis/orion-latest.json
```

**Expected**: File validates against [squad-analysis-artifact.schema.json](./contracts/squad-analysis-artifact.schema.json).

**Negative test**: Remove artifact → follow-up cycle returns "run analysis first" (FR-037, SC-005).

---

## 3. Run deterministic mapper tests (offline)

```bash
npm test -- tests/unit/followups
```

**Expected**: All suites pass without live Jira/Slack.

**Scenarios covered** (FR-041, User Story 1):
- Stale in-progress → `progress-update` proposal with assignee
- Unowned blocker → `blocker-clarification`
- Missing estimate → `estimate-reminder`
- Duplicate (engineer, issue, reason) → merged single proposal (FR-031)
- >10 candidates → top 10 by urgency/confidence + overflow disclosure
- No mappable findings → zero proposals, explicit message (SC-005)

---

## 4. Dry-run follow-up cycle preview (offline)

```bash
npm run followups:cycle -- --text "followups Orion" --fixture --dry-run
```

**Expected**:
- Numbered proposals (1…N) with issue, engineer, reason, draft, confidence, urgency
- Supported commands listed (`approve`, `edit`, `ignore`, `approve all`, `status`, `done`)
- Analysis timestamp shown; stale flag when fixture `analyzedAt` > 24h old
- No Slack API calls in `--dry-run` mode

---

## 5. Command parsing spot-check (offline)

```bash
npm test -- tests/unit/followups/parse-commands
```

**Verify transcripts** in `fixtures/followups/command-transcript-approve.json`:

| Input | Expected parse |
|-------|----------------|
| `approve 1,2` | approve indexes [1,2] |
| `edit 3: Can you share an ETA?` | edit index 3 |
| `approve all` | approveAll |
| `status` | status |
| `done` | closeCycle |
| `approve 99` | unknownCommand / validation (no send) |

---

## 6. Live follow-up cycle smoke (P1)

**Setup**: Cursor Automation per [docs/automations/followups-slack.md](../../docs/automations/followups-slack.md):

1. Trigger: `slackTrigger` on manager destination (filter: message contains `followups` or `follow-ups`)
2. Agent prompt: `prompts/automation/followups-instructions.md`
3. Script: `npm run followups:cycle -- --text "$MESSAGE" --slack-channel $CHANNEL --thread-ts $THREAD_TS --poll`

**Steps**:
1. Run EngPilot analysis for squad: `analyze Orion squad` (001) — confirms artifact written.
2. Post `followups Orion` in manager channel.
3. Wait for numbered proposal preview in thread.
4. Reply in thread: `approve 1` (or `approve all` for bulk test).
5. Verify engineer receives private DM; manager receives delivery summary.
6. Reply `done` to close cycle.

**Expected** (SC-002, SC-003, SC-013):
- Zero DMs before explicit approve
- DMs go to mapped Slack users only (not public channel)
- Missing map → `skipped: missing recipient mapping` without failing other sends

---

## 7. Reply summary smoke (P2)

**Setup**: Continue from §6 with at least one sent DM, or use fixture mode with simulated replies.

**Steps**:
1. Have engineer reply to DM (or load reply fixture).
2. Manager sends `status` in follow-up thread (while poll loop active).

**Expected** (SC-006, SC-007, SC-008):
- Summary grouped by engineer with Jira issue keys
- Blocker reply → `manager attention recommended`
- Progress confirmation → `no further follow-up needed`
- No autonomous follow-up DM sent as side effect of summary

---

## 8. Cycle context smoke (P3)

**Steps** (fixture-driven or live):
1. Approve initial progress-update to engineer A on issue `MTN-123`.
2. Simulate reply: "waiting on API contract — no ETA".
3. Manager sends `status`, then requests continuation draft (implement: `draft another <n>` or re-proposal path).
4. Verify new draft references API contract, does not repeat verbatim "current progress?" question.

**Fresh cycle test**: New `followups Orion` after prior `done` → no reference to prior cycle (FR-032).

---

## 9. Staleness and error paths

| Scenario | Command | Expected |
|----------|---------|----------|
| Stale analysis (>24h) | `followups Orion` | Preview with `possibly stale` + timestamp; cycle still runs |
| Unknown squad | `followups Growth` | Validation listing configured squads |
| No artifact | `followups Orion` | Ask to run `analyze Orion squad` first |
| All ignored | `ignore 1` … then `done` | Zero DMs; clean close summary |

---

## 10. Cursor Automation artifacts

After implementation, verify committed artifacts exist:

- [ ] `docs/automations/followups-slack.md`
- [ ] `prompts/automation/followups-instructions.md`
- [ ] `prompts/followup-draft-compose.md`
- [ ] `prompts/reply-extract.md`
- [ ] `specs/002-engineering-communication-assistant/contracts/*`
- [ ] `.gitignore` includes `.squadpulse/`

---

## Validation checklist (plan gate)

- [ ] Deterministic mapper tests pass offline
- [ ] AI draft output validates against proposal schema (FR-042)
- [ ] 0 engineer DMs without manager approve (SC-002)
- [ ] 0 Jira writes during cycle (SC-010)
- [ ] No hosted backend, database, or Block Kit interactivity introduced (SC-011)
- [ ] Reply summary never auto-sends follow-ups (SC-008)
