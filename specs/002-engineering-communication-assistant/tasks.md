# Tasks: Engineering Communication Assistant (MVP)

**Input**: Design documents from `/specs/002-engineering-communication-assistant/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, analysis.md

**Tests**: Included — spec FR-041/FR-042 and user request require deterministic unit tests and quickstart validation.

**Organization**: Tasks grouped by user story (P1 → P2 → P3) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label ([US1], [US2], [US3]) for story-phase tasks only
- Every task includes an exact file path

## Path Conventions

Single TypeScript package at repository root — additive to feature 001:

- `src/followups/` — follow-up cycle logic
- `src/slack/` — Slack parsing, DM delivery, thread polling
- `src/analysis/` — 001 artifact writer extension
- `src/contracts/` — Zod types mirroring JSON Schema contracts
- `tests/unit/followups/`, `tests/unit/slack/` — offline Vitest suites
- `fixtures/analysis/`, `fixtures/followups/` — anonymized test data
- `docs/automations/` — Cursor Automation runbooks

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffolding, gitignore, and npm entry point for the follow-up workflow

- [x] T001 Add `.squadpulse/` runtime directory entries to `.gitignore`
- [x] T002 Create directory scaffolding per plan.md: `src/followups/`, `fixtures/analysis/`, `fixtures/followups/`, `tests/unit/followups/`, `tests/unit/slack/`, `prompts/automation/`
- [x] T003 Add `followups:cycle` npm script in `package.json` pointing at `src/cli/followups-cycle.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Config schema, contracts, 001→002 artifact bridge — MUST complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 [P] Extend `config/em-copilot.schema.json` with optional `communicationAssistant` block (`analysisFreshnessHours`, `maxProposalsPerCycle`, `cycleMaxMinutes`, `pollIntervalSeconds`, `analysisArtifactDir`)
- [x] T005 Extend `src/contracts/config.ts` Zod schema with matching optional `communicationAssistant` object and defaults per data-model.md
- [x] T006 Update `config/em-copilot.example.yml` with documented `communicationAssistant` defaults (FR-009, FR-019)
- [x] T007 [P] Implement `src/contracts/squad-analysis-artifact.ts` Zod schema mirroring `specs/002-engineering-communication-assistant/contracts/squad-analysis-artifact.schema.json`
- [x] T008 [P] Implement `src/contracts/follow-up-proposal.ts` Zod schema mirroring `specs/002-engineering-communication-assistant/contracts/follow-up-proposal.schema.json`
- [x] T009 [P] Implement `src/contracts/follow-up-cycle.ts` Zod schema mirroring `specs/002-engineering-communication-assistant/contracts/follow-up-cycle.schema.json`
- [x] T010 [P] Implement `src/contracts/follow-up-slack-request.ts` Zod schema mirroring `specs/002-engineering-communication-assistant/contracts/follow-up-slack-request.schema.json`
- [x] T011 [P] Implement `src/contracts/reply-summary.ts` Zod schema mirroring `specs/002-engineering-communication-assistant/contracts/reply-summary.schema.json`
- [x] T012 [P] Implement `src/contracts/follow-up-run-result.ts` Zod schema mirroring `specs/002-engineering-communication-assistant/contracts/follow-up-run-result.schema.json`
- [x] T013 Implement `src/analysis/write-artifact.ts` to emit `{squadId}-latest.json` under configured `analysisArtifactDir` (default `.squadpulse/analysis/`) on successful analysis
- [x] T014 Wire `src/analysis/write-artifact.ts` into `src/cli/on-demand.ts` success path after analyze+render completes
- [x] T015 Wire `src/analysis/write-artifact.ts` into `src/cli/daily.ts` per-squad success path
- [x] T016 Implement `src/followups/load-artifact.ts` to read, validate SquadAnalysisArtifact, and compute FR-009 `possiblyStale` flag from config
- [x] T017 [P] Create `fixtures/analysis/orion-mixed-findings.json` covering stale in-progress, unowned blocker, missing estimate, and sprint-risk findings from User Story 1 acceptance scenarios
- [x] T018 [P] Unit tests for artifact write/load in `tests/unit/analysis/write-artifact.test.ts`
- [x] T019 [P] Extend `tests/unit/config/validate.test.ts` with `communicationAssistant` block acceptance and validation error cases

**Checkpoint**: Foundation ready — artifact bridge, config, and contracts in place; user story implementation can begin

---

## Phase 3: User Story 1 — Manager-Approved Follow-Up Cycle in Slack (Priority: P1) 🎯 MVP

**Goal**: Manager invokes `followups <squad>`, reviews numbered proposals with evidence, approves/edits/ignores via text commands, and only approved proposals are sent as private Slack DMs with delivery summary returned.

**Independent Test**: Seed `fixtures/analysis/orion-mixed-findings.json` as artifact; run `npm run followups:cycle -- --text "followups Orion" --fixture --dry-run`; verify numbered proposals with all six fields, approve/edit/ignore commands process correctly, and only approved proposals would trigger DM delivery (mocked).

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T020 [P] [US1] Unit tests for finding→reason-type mapping in `tests/unit/followups/map-findings-to-proposals.test.ts` (stale→progress-update, unowned blocker→blocker-clarification, missing estimate→estimate-reminder, unmapped→skip with disclosure)
- [x] T021 [P] [US1] Unit tests for confidence/urgency assignment in `tests/unit/followups/assign-confidence-urgency.test.ts` per FR-017/FR-018 rules
- [x] T022 [P] [US1] Unit tests for de-duplication and cap/overflow in `tests/unit/followups/deduplicate-proposals.test.ts` (FR-031 merge key; top-N by urgency/confidence; overflow disclosure)
- [x] T023 [P] [US1] Unit tests for follow-up Slack command parsing in `tests/unit/slack/parse-followup-request.test.ts` (startCycle, approve, edit, ignore, approve all, unknown command validation)

### Implementation for User Story 1

- [x] T024 [US1] Implement `src/followups/assign-confidence-urgency.ts` deterministic FR-017/FR-018 rules using artifact snapshot priority tier and sprint timing
- [x] T025 [US1] Implement `src/followups/map-findings-to-proposals.ts` deterministic FR-010–013 mapper consuming SquadAnalysisArtifact per research.md §4
- [x] T026 [US1] Implement `src/followups/cycle-state.ts` in-memory FollowUpCycle factory, proposal numbering, and status transitions per data-model.md state machine
- [x] T027 [US1] Implement `src/slack/parse-followup-request.ts` separate from 001 `parse-request.ts` for followups intents (startCycle, approve, edit, ignore, approveAll, closeCycle, unknownSquad, unknownCommand) reusing 001 squad resolution (FR-007)
- [x] T028 [US1] Implement `src/followups/process-manager-command.ts` for approve/edit/ignore/approveAll/closeCycle with FR-020 index validation and helpful unknown-command replies (FR-019)
- [x] T029 [US1] Implement `src/followups/render-cycle-preview.ts` numbered proposals (1…N), command help text, analysis timestamp/staleness disclosure, and data-limitations bullet list including overflow line (FR-009, FR-019, FR-040)
- [x] T030 [P] [US1] Create `prompts/followup-draft-compose.md` with FR-015/FR-016 language guardrails (polite, non-accusatory, no ranking/HR language, no urgency label in draft)
- [x] T031 [US1] Implement `src/ai/validate-followup-proposal.ts` Zod validation plus post-validation regex checks for prohibited language (FR-042)
- [x] T032 [US1] Implement `src/followups/compose-proposal-drafts.ts` two-step pipeline: deterministic scaffold from mapper output + AI compose hook with fixture-mode stub for offline tests
- [x] T033 [US1] Implement `src/slack/dm-deliver.ts` with `openDmChannel`, `postDirectMessage`, bounded retry via `src/lib/retry.ts`, and skip-on-missing-mapping (FR-023–026)
- [x] T034 [US1] Implement `src/followups/render-delivery-summary.ts` per-proposal sent/failed/skipped results and aggregate cycle status (FR-022)
- [x] T035 [US1] Implement `src/slack/poll-thread.ts` blocking manager-thread poll loop using `conversations.replies` at `pollIntervalSeconds` until cycle end or `cycleMaxMinutes` (research.md §2)
- [x] T036 [US1] Implement `src/cli/followups-cycle.ts` CLI entry: parse args (`--text`, `--slack-channel`, `--thread-ts`, `--fixture`, `--dry-run`), load artifact (FR-037 on missing), map+compose proposals, post preview, poll for manager commands, send approved DMs, emit FollowUpRunResult JSON
- [x] T037 [US1] Handle edge cases in `src/cli/followups-cycle.ts`: zero proposals message (SC-005), unknown squad validation (FR-007), missing `teamMemberSlackMap` config error, all-ignored cycle summary
- [x] T038 [P] [US1] Create `fixtures/followups/command-transcript-approve.json` for approve 1,2 / edit 3 / ignore 4 / approve all scenarios
- [x] T039 [US1] Dry-run integration test in `tests/unit/followups/followups-cycle-dry-run.test.ts` exercising preview generation with `--fixture --dry-run` per quickstart.md §4

**Checkpoint**: User Story 1 fully functional — manager can preview, approve, and send DMs without reply monitoring

---

## Phase 4: User Story 2 — Reply Monitoring and Manager Summary (Priority: P2)

**Goal**: After DMs are sent, manager sends `status` to read engineer DM replies within the cycle window and receive a concise per-engineer/per-issue summary with recommendations — no autonomous follow-up sends.

**Independent Test**: Drive fixture cycle with three delivered messages and `fixtures/followups/engineer-replies.json`; invoke status path; verify blocker flagged `manager attention recommended`, progress reply `no further follow-up needed`, "not started" reply `another follow-up suggested (draft on request)`, and zero outbound engineer messages.

### Tests for User Story 2

- [x] T040 [P] [US2] Unit tests for reply classifier recommendations in `tests/unit/followups/summarize-replies.test.ts` (blocker phrases, ETA patterns, empty/emoji-only, no-reply marker, unreadable marker)
- [x] T041 [P] [US2] Unit tests for status command handling in `tests/unit/followups/status-command.test.ts`

### Implementation for User Story 2

- [x] T042 [US2] Extend `src/slack/dm-deliver.ts` with `readDmReplies(dmChannelId, sentMessageTs, engineerUserId)` using `conversations.history` (FR-027, FR-039)
- [x] T043 [P] [US2] Create `prompts/reply-extract.md` for AI enrich phase on ambiguous replies (FR-042)
- [x] T044 [US2] Implement `src/ai/validate-reply-summary.ts` schema validation for AI reply extraction output against `src/contracts/reply-summary.ts`
- [x] T045 [US2] Implement `src/followups/summarize-replies.ts` deterministic classifier first with optional AI enrich; fixed recommendation enum FR-028; HR-adjacent content neutralization FR-036
- [x] T046 [US2] Implement `src/followups/render-reply-summary.ts` grouped-by-engineer manager summary with data-limitations bullet list (FR-028, FR-040)
- [x] T047 [US2] Extend `src/followups/process-manager-command.ts` with `status` command handler
- [x] T048 [US2] Wire `status` command into poll loop in `src/cli/followups-cycle.ts`: read DM replies for sent deliveries, summarize, post reply summary to manager thread
- [x] T049 [P] [US2] Create `fixtures/followups/engineer-replies.json` with blocker/progress/no-reply/not-started scenarios from User Story 2 acceptance scenarios

**Checkpoint**: User Stories 1 and 2 both work — approve/send plus reply summary within same blocking cycle

---

## Phase 5: User Story 3 — Cycle Context Awareness (Priority: P3)

**Goal**: Within one cycle, assistant tracks prior questions/replies, avoids repeating the same question verbatim, and generates continuation drafts referencing prior engineer answers via `draft another <n>` — no cross-cycle memory.

**Independent Test**: Simulate cycle where engineer A replied about API contract pending; invoke `draft another <n>`; verify new draft references prior answer and does not repeat "current progress?" verbatim; fresh `/followups` invocation has empty context (FR-032).

### Tests for User Story 3

- [x] T050 [P] [US3] Unit tests for in-cycle context in `tests/unit/followups/cycle-context.test.ts` (askedPairs tracking, capturedReplies, continuation draft scaffold, no cross-cycle carryover)

### Implementation for User Story 3

- [x] T051 [US3] Extend `src/followups/cycle-state.ts` with `InCycleContext` (`askedPairs`, `capturedReplies`) updated on send and status read (FR-030)
- [x] T052 [US3] Update `src/followups/map-findings-to-proposals.ts` to merge evidence for duplicate `(engineer, issueKey, reasonType)` before preview (FR-031)
- [x] T053 [US3] Extend `src/followups/process-manager-command.ts` with `draftAnother` command parsing and validation (FR-019)
- [x] T054 [US3] Update `src/followups/compose-proposal-drafts.ts` to inject matching `capturedReplies` into AI scaffold for continuation proposals (FR-030)
- [x] T055 [US3] Wire `draftAnother` into poll loop in `src/cli/followups-cycle.ts`: generate new pending proposal, re-render preview subset, flow through same approve workflow
- [x] T056 [US3] Ensure FR-032 compliance in `src/cli/followups-cycle.ts`: discard all in-cycle state on exit; never read `.squadpulse/cycles/` across invocations in MVP

**Checkpoint**: All three user stories independently functional with cycle-scoped context only

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Automation docs, Slack delivery tests, and quickstart validation across all stories

- [x] T057 [P] Create `docs/automations/followups-slack.md` Cursor Automation `slackTrigger` setup (followups intent filter, blocking `followups:cycle` invocation, required Slack bot scopes)
- [x] T058 [P] Create `prompts/automation/followups-instructions.md` agent instructions for poll-loop cycle orchestration
- [x] T059 [P] Unit tests for DM delivery with mocked `@slack/web-api` in `tests/unit/slack/dm-deliver.test.ts` (sent, rate-limit retry, skip missing mapping, auth failure no-retry)
- [x] T060 Extend `docs/em-copilot.md` with Engineering Communication Assistant section linking to `docs/automations/followups-slack.md` and quickstart
- [x] T061 Run all scenarios in `specs/002-engineering-communication-assistant/quickstart.md` (offline mapper tests, dry-run preview, fixture status summary) and fix any gaps found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **User Story 1 (Phase 3)**: Depends on Foundational — MVP target
- **User Story 2 (Phase 4)**: Depends on Foundational + US1 DM delivery and poll loop (T033, T035, T036)
- **User Story 3 (Phase 5)**: Depends on Foundational + US1 cycle state + US2 capturedReplies path (T051 builds on T026; T054 builds on T045)
- **Polish (Phase 6)**: Depends on US1 minimum; full validation after US2/US3

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on US2/US3
- **User Story 2 (P2)**: Requires US1 delivery + poll loop; reply summary is independently testable with fixtures once DMs are mock-sent
- **User Story 3 (P3)**: Requires US1 proposal/approve flow + US2 reply capture; independently testable via cycle-context unit tests

### Within Each User Story

- Tests (T020–T023, T040–T041, T050) written first — must FAIL before implementation
- Deterministic modules before AI compose/validate layers
- Renderers after domain logic
- CLI wiring last within each story
- Story checkpoint before next priority

### Parallel Opportunities

- **Phase 1**: All tasks sequential (small)
- **Phase 2**: T004–T012, T017–T019 can run in parallel after T001–T003; T013–T016 sequential
- **Phase 3**: T020–T023 parallel; T030 parallel with T024–T029; T038 parallel with T036–T037
- **Phase 4**: T040–T041 parallel; T043 parallel with T042; T049 parallel with T045–T048
- **Phase 5**: T050 parallel with early T051 work; T052–T055 mostly sequential
- **Phase 6**: T057–T059 parallel; T061 after prior phases

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (must fail first):
npm test -- tests/unit/followups/map-findings-to-proposals.test.ts
npm test -- tests/unit/followups/assign-confidence-urgency.test.ts
npm test -- tests/unit/followups/deduplicate-proposals.test.ts
npm test -- tests/unit/slack/parse-followup-request.test.ts

# Launch parallel implementation tracks after tests exist:
# Track A: T024 assign-confidence-urgency.ts + T025 map-findings-to-proposals.ts
# Track B: T027 parse-followup-request.ts + T028 process-manager-command.ts
# Track C: T030 prompts/followup-draft-compose.md + T031 validate-followup-proposal.ts
```

---

## Parallel Example: Foundational Contracts

```bash
# All contract Zod files can be authored in parallel:
# T007 squad-analysis-artifact.ts
# T008 follow-up-proposal.ts
# T009 follow-up-cycle.ts
# T010 follow-up-slack-request.ts
# T011 reply-summary.ts
# T012 follow-up-run-result.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T019) — includes 001 artifact writer
3. Complete Phase 3: User Story 1 (T020–T039)
4. **STOP and VALIDATE**: Run quickstart §3–§4 offline; verify approve/send dry-run
5. Demo manager-approved DM cycle before adding reply monitoring

### Incremental Delivery

1. Setup + Foundational → artifact bridge and config ready
2. User Story 1 → Test independently → **MVP deploy** (preview + approve + DM send)
3. User Story 2 → Test independently → add `status` reply summary
4. User Story 3 → Test independently → add continuation drafts via `draft another`
5. Polish → automation docs + full quickstart pass

### Parallel Team Strategy

With multiple developers after Foundational completes:

- **Developer A**: User Story 1 (mapper, CLI, DM delivery)
- **Developer B**: User Story 2 (reply classifier, status command) — starts after US1 T033/T035 land
- **Developer C**: Docs/fixtures (T057–T060) in parallel with US1 tail

---

## Notes

- Poll loop is blocking inside one Cursor Cloud Agent run — no Block Kit interactivity (FR-006)
- Cap enforcement (`maxProposalsPerCycle`) is runtime config, not JSON Schema hard cap (analysis I1 fix)
- SC-014–SC-017 (manager self-report KPIs) are post-launch adoption metrics — excluded from build tasks
- Fallback thread-keyed state file across invocations (autopilot U3) is out of MVP scope per FR-043
