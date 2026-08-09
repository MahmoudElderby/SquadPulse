# Research: Engineering Communication Assistant (MVP)

**Feature**: `002-engineering-communication-assistant`  
**Date**: 2026-08-09  
**Status**: Complete — all Technical Context unknowns resolved

## Research Tasks & Outcomes

### 1. EngPilot analysis input bridge (001 → 002)

**Decision**: Introduce a **SquadAnalysisArtifact** JSON file written by feature 001 on every successful on-demand or daily squad analysis, and read by feature 002 at cycle start.

| Aspect | Choice |
|--------|--------|
| Location | `.squadpulse/analysis/{squadId}-latest.json` (gitignored runtime dir) |
| Config key | `communicationAssistant.analysisArtifactDir` (optional override, default `.squadpulse/analysis`) |
| Contents | `squadId`, `analyzedAt` (ISO 8601), `workflow`, `snapshot` (subset: sprint timing, assignees), `deterministicFindings`, `contextualAnalysis` (optional), `limitations` |
| Contract | [contracts/squad-analysis-artifact.schema.json](./contracts/squad-analysis-artifact.schema.json) |

Feature 002 reads the artifact for the requested squad. If missing → FR-037 message naming `analyze <squad>` trigger. If `analyzedAt` older than `communicationAssistant.analysisFreshnessHours` (default 24) → flag `possibly stale` in preview (FR-009) without blocking.

**Rationale**: Spec FR-008 requires consuming the most recent EngPilot analysis without re-running Jira fetch on every follow-up command. A gitignored JSON artifact is not a database or hosted service (Constitution I, XII); it is the same lightweight pattern as fixture files for offline testing (Constitution X). Coordination with 001 is a small additive write in existing `analyze:on-demand` / `analyze:daily` success paths.

**Alternatives considered**:
- *Re-run full 001 pipeline inside every follow-up cycle* — rejected; violates "reuse most recent analysis" semantics and duplicates Jira cost.
- *Parse prior Slack report Markdown* — rejected; lossy, not structured, fails FR-012 evidence traceability.
- *Cursor run-history API as storage* — rejected; no stable read API from repo scripts; not repository source of truth (Constitution XI).

---

### 2. Follow-up cycle orchestration (multi-turn Slack without hosted listener)

**Decision**: **Single blocking npm script invocation per cycle** with an **in-process Slack thread poll loop**.

| Aspect | Choice |
|--------|--------|
| Entry | `npm run followups:cycle -- --text "<message>" --slack-channel $CHANNEL --thread-ts $THREAD_TS` |
| Trigger filter | Cursor Automation `slackTrigger` fires on manager destination when message matches `followups` / `follow-ups` intent (not on bare `approve`/`status` alone) |
| After preview | Script polls `conversations.replies` on the manager thread every **5s** (configurable `communicationAssistant.pollIntervalSeconds`) until cycle end |
| Cycle end | Manager sends `done` / `close cycle`, all proposals terminal with no pending work, configurable max idle (`communicationAssistant.cycleMaxMinutes`, default **60**), or unrecoverable error |
| In-cycle state | In-memory `FollowUpCycle` object for script lifetime; optional crash snapshot to `.squadpulse/cycles/{threadTs}.json` deleted on clean cycle end |

Manager commands (`approve`, `edit`, `ignore`, `approve all`, `status`, `done`) are read from new thread replies during the poll loop — **not** via Block Kit interactivity URLs (Constitution I, FR-006).

**Rationale**: Clarifications Session 2026-08-09 bound the reply-monitoring window to the Cursor Cloud Agent run (FR-027, FR-043). A blocking poll loop keeps the entire approve → send → status cycle inside one agent/script execution without a persistent Socket Mode bot or interactivity endpoint. Text-only commands match assumption 5.

**Alternatives considered**:
- *Slack Block Kit buttons + interactivity URL* — rejected; requires hosted listener (Constitution I).
- *Separate automation invocation per manager command with thread-keyed state file* — viable fallback if Cursor run timeout blocks polling; deferred unless poll loop proves insufficient in implement phase. Would extend logical cycle across runs and require explicit `done` to delete state file.
- *Long-lived background agent outside Cursor* — rejected; constitutional violation.

---

### 3. Slack command parsing (follow-up intent surface)

**Decision**: Extend parsing in `src/slack/parse-followup-request.ts` (new module; do not overload 001 `parse-request.ts` analysis intents).

| Intent | Keywords / patterns |
|--------|---------------------|
| `startCycle` | `followups`, `follow-ups`, `follow ups` + squad token |
| `approve` | `approve <n>`, `approve <n,m,...>`, `approve all` |
| `edit` | `edit <n>: <text>` |
| `ignore` | `ignore <n>` |
| `status` | `status` (optional squad echo ignored if present) |
| `draftAnother` | `draft another <n>` — after reply summary recommends continuation for proposal `<n>` (FR-030, FR-019) |
| `closeCycle` | `done`, `close cycle` |

Squad resolution reuses 001 rules: case-insensitive, whitespace-collapsed, trailing punctuation tolerant, exact match on display name or alias (FR-007). Contract: [contracts/follow-up-slack-request.schema.json](./contracts/follow-up-slack-request.schema.json).

**Rationale**: FR-006 distinguishes follow-up workflow from analysis intents (`analyze`, `blockers`, …). Separate parser avoids precedence collisions with 001 `follow-up` analysis intent.

**Alternatives considered**:
- *Single unified parser with merged intent list* — rejected; `follow-up` in 001 means "analysis report section", not communication cycle.

---

### 4. Finding → proposal conversion (deterministic core)

**Decision**: Deterministic mapper in `src/followups/map-findings-to-proposals.ts` consuming `SquadAnalysisArtifact`.

| Source finding | Follow-up reason type (FR-011) | Recipient (FR-013) |
|----------------|-------------------------------|---------------------|
| `deliveryRisks` category `staleInProgress`, `noRecentUpdate` | `progress-update` | Issue assignee from snapshot |
| `blockers` with `isOwned === false` or missing `dependencyOwner` | `blocker-clarification` | Assignee, or dependency owner if present |
| `blockers` / `deliveryRisks` `crossSquadDependency` | `dependency-follow-up` | Dependency owner if identified, else assignee |
| `hygieneFindings` `missingEstimate` | `estimate-reminder` | Assignee |
| `hygieneFindings` `statusInconsistency`, `completedStillOpen` | `jira-status-reminder` | Assignee |
| `deliveryRisks` `lateStart`, `unplannedScope` + health `At Risk`/`Needs Attention` | `sprint-risk-clarification` | Assignee |
| `flowSignals`, `missingAssignee`, unmapped hygiene | — | Skip with disclosure (FR-011, FR-013) |

De-duplication key: `(engineerDisplayName, issueKey, reasonType)` per FR-031. Cap: top 10 by `(urgency DESC, confidence DESC)` per FR-019.

**Confidence assignment (FR-017)** — evidence strength only (draft wording does not change confidence):
- `High` — proposal sourced from a deterministic finding category with unambiguous Jira signal
- `Medium` — contextual AI-derived finding with corroborating deterministic signal in the artifact
- `Low` — contextual AI-derived finding without corroborating deterministic signal (rare; prefer skip)

**Urgency assignment (FR-018)** — deterministic rules using snapshot priority tier + sprint elapsed fraction + blocker ownership:
- `High` — P0/P1 issue with unowned blocker, or sprint elapsed ≥ 80% with stale/blocked P0/P1
- `Medium` — stale/no-update on P2+, missing estimate mid-sprint, unclear status on active work
- `Low` — routine hygiene with >50% sprint remaining and no adjacent risk signal

**Rationale**: FR-041 requires deterministic paths testable offline. Mapping table is fully fixture-testable without AI.

**Alternatives considered**:
- *AI-only proposal selection* — rejected; fails testability and evidence gates.
- *Reuse 001 `FollowUpDraft` objects directly* — rejected; 001 drafts lack reason type, confidence, urgency, and per-issue proposal model required by FR-014.

---

### 5. Draft message generation (AI boundary)

**Decision**: Two-step draft pipeline:

1. **Deterministic scaffold** — issue key, reason type, evidence bullets, recipient name, in-cycle prior Q&A (FR-030).
2. **AI compose phase** — Cursor agent prompt `prompts/followup-draft-compose.md` produces structured JSON validated by Zod / [contracts/follow-up-proposal.schema.json](./contracts/follow-up-proposal.schema.json) (`draftMessage` field only AI-owned).

Language guardrails enforced in prompt + post-validation regex checks (no ranking, no numeric confidence, no urgency label in draft text — FR-015, FR-016, FR-018).

**Rationale**: Matches 001 two-phase pattern (Constitution X). Deterministic mapping owns eligibility; AI owns wording only.

**Alternatives considered**:
- *Template-only drafts without AI* — acceptable for tests; insufficient for SC-004 neutral tone variety.
- *Send 001 report draft text verbatim* — rejected; 001 drafts are manager-facing observation/request pairs, not engineer DM copy.

---

### 6. Slack DM delivery and reply reading

**Decision**: Extend `src/slack/` with:

| Function | API | Notes |
|----------|-----|-------|
| `openDmChannel(userId)` | `conversations.open` | Resolve DM channel for mapped Slack user |
| `postDirectMessage(userId, text)` | `chat.postMessage` | FR-023 private DM only |
| `readDmReplies(dmChannelId, sentMessageTs)` | `conversations.history` | Messages with `ts > sentMessageTs` from engineer user |

Retry: reuse 001 `retryWithBackoff` — max 3 attempts, 1s/2s/4s, 60s cap, no retry on auth failure (FR-026).

Bot scopes required (document in quickstart): `chat:write`, `im:write`, `im:history`, `users:read` (for mapping validation).

**Rationale**: Same `@slack/web-api` dependency as 001 (Constitution VIII). Read-only reply fetch; no Socket Mode.

**Alternatives considered**:
- *Email fallback* — out of scope (FR-002).
- *Post in manager channel mentioning engineer* — rejected; violates FR-023/FR-034 privacy model.

---

### 7. Reply extraction and manager summary

**Decision**: Hybrid pipeline in `src/followups/summarize-replies.ts`:

1. **Deterministic classifier** — fixture-testable rules for blocker phrases, ETA patterns, "not started", empty/emoji-only → recommendation enum (FR-028, FR-041).
2. **AI enrich phase** — prompt `prompts/reply-extract.md` produces validated [contracts/reply-summary.schema.json](./contracts/reply-summary.schema.json) for nuanced extractions only when deterministic class is ambiguous.

Recommendations fixed set: `no further follow-up needed`, `another follow-up suggested (draft on request)`, `manager attention recommended`. No autonomous follow-up send (FR-029).

Unreadable replies → `unreadable: <reason>` (FR-039). No reply yet → `no reply yet within cycle window` (FR-027).

**Rationale**: Constitution X — deterministic rules tested; AI fills gaps with schema validation (FR-042).

---

### 8. In-cycle context (FR-030, FR-031, FR-032)

**Decision**: `InCycleContext` embedded in `FollowUpCycle` state:

| Field | Purpose |
|-------|---------|
| `askedPairs[]` | `{ engineer, issueKey, reasonType, draftSent, sentAt }` |
| `capturedReplies[]` | `{ engineer, issueKey, extraction, rawInternal }` — raw not rendered to manager verbatim for HR-adjacent content (FR-036) |

On `another follow-up suggested` + manager `draft another <n>` command (FR-019), mapper passes prior extraction into AI compose prompt. Cycle context discarded when poll loop exits (FR-032).

**Rationale**: No cross-cycle persistence; satisfies trust-preservation user story P3.

---

### 9. Configuration extensions (001-owned file)

**Decision**: Add optional top-level block to `config/em-copilot.yml`:

```yaml
communicationAssistant:
  analysisFreshnessHours: 24
  maxProposalsPerCycle: 10
  cycleMaxMinutes: 60
  pollIntervalSeconds: 5
  analysisArtifactDir: .squadpulse/analysis
```

Validated via extended JSON Schema in 001 `config-schema.json` (additive optional properties — no breaking change).

**Rationale**: Constitution VII — single configuration surface; spec Assumptions and FR-009/FR-019 name these keys.

---

### 10. Toolchain and testing (inherit from 001)

**Decision**: No new language or major dependencies. Reuse TypeScript 5.x, Node 20, Vitest, Zod, `@slack/web-api`, Luxon.

New test directories:
- `tests/unit/followups/` — mapping, urgency/confidence, de-duplication, command parsing
- `tests/unit/slack/` — DM delivery mocks, reply read mocks
- `fixtures/analysis/` — sample SquadAnalysisArtifact files
- `fixtures/followups/` — command transcripts and reply fixtures

**Rationale**: Constitution XII incremental slice on existing package; minimizes operational surface.

---

## Resolved Technical Context (was NEEDS CLARIFICATION in template)

| Item | Resolution |
|------|------------|
| Language/Version | TypeScript 5.x / Node 20 LTS (inherit 001) |
| Primary Dependencies | Zod, `@slack/web-api`, Luxon, Vitest (no additions) |
| Storage | Gitignored artifact + in-memory cycle state only |
| Testing | Vitest + fixtures; no live Jira/Slack for deterministic suites |
| Target Platform | Cursor Automation `slackTrigger` + blocking poll script |
| Project Type | CLI modules in existing `squadpulse-em-copilot` package |
| Performance Goals | Cycle preview < 30s; poll loop ≤ 60 min default; DM send batch < 2 min for 10 proposals |
| Constraints | Cursor-only; text commands only; no Jira writes; manager approval gate |
| Scale/Scope | 2 squads; ≤10 proposals/cycle; 1 manager destination |

## Blockers

**None.** All NEEDS CLARIFICATION items resolved. Proceed to Phase 1 design artifacts and constitution re-check.
