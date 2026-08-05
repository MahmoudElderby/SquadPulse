# Tasks: Engineering Manager Copilot (MVP)

**Input**: Design documents from `/specs/001-em-copilot/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included for deterministic rules (FR-046, SC-014, Constitution X), config validation (SC-010), and parser/renderer contracts — not full TDD-first for all layers.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1, US2, US3) — omitted in Setup, Foundational, and Polish phases
- Every task includes exact file path(s)

## Path Conventions

Single TypeScript package at repository root per plan.md: `src/`, `tests/`, `config/`, `fixtures/`, `prompts/`, `docs/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and repository scaffold

- [X] T001 Create package.json with npm scripts (`test`, `config:validate`, `analyze:on-demand`, `analyze:daily`, `analyze:fixture`, `validate:contextual`) and dependencies (TypeScript 5.x, Zod, Ajv, Luxon, `@slack/web-api`, Vitest, yaml) in `package.json`
- [X] T002 Create TypeScript 5.x ESM config for Node 20 in `tsconfig.json`
- [X] T003 Create Vitest configuration in `vitest.config.ts`
- [X] T004 [P] Create directory scaffold per plan.md (`src/cli/`, `src/config/`, `src/jira/`, `src/analysis/rules/`, `src/slack/`, `src/report/`, `src/ai/`, `src/contracts/`, `src/lib/`, `tests/unit/`, `tests/integration/`, `fixtures/jira/`, `fixtures/ai/`, `prompts/automation/`, `docs/automations/`, `config/`)
- [X] T005 [P] Create package entry barrel in `src/index.ts`
- [X] T006 Copy JSON Schema contract to config path: `specs/001-em-copilot/contracts/config-schema.json` → `config/em-copilot.schema.json`
- [X] T007 Create two-squad example configuration with boards, aliases, status/priority mappings, and default thresholds in `config/em-copilot.example.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Config, Jira layer, deterministic analysis engine, and shared utilities — MUST complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 [P] Create Zod mirror for config schema in `src/contracts/config.ts` from `specs/001-em-copilot/contracts/config-schema.json`
- [X] T009 [P] Create Zod mirror for normalized snapshot in `src/contracts/normalized-squad-snapshot.ts` from `specs/001-em-copilot/contracts/normalized-squad-snapshot.schema.json`
- [X] T010 [P] Create Zod mirror for deterministic findings in `src/contracts/deterministic-findings.ts` from `specs/001-em-copilot/contracts/deterministic-findings.schema.json`
- [X] T011 [P] Create Zod mirror for contextual analysis in `src/contracts/contextual-analysis.ts` from `specs/001-em-copilot/contracts/contextual-analysis.schema.json`
- [X] T012 [P] Create Zod mirror for slack request in `src/contracts/slack-request.ts` from `specs/001-em-copilot/contracts/slack-request.schema.json`
- [X] T013 [P] Create Zod mirror for daily briefing in `src/contracts/daily-briefing.ts` from `specs/001-em-copilot/contracts/daily-briefing.schema.json`
- [X] T014 [P] Create Zod mirror for run result in `src/contracts/run-result.ts` from `specs/001-em-copilot/contracts/run-result.schema.json`
- [X] T015 Implement YAML config loader in `src/config/load.ts`
- [X] T016 Implement config validator with Ajv JSON Schema plus alias-overlap and at-least-one-board checks (FR-005, FR-009, SC-010) in `src/config/validate.ts`
- [X] T017 Implement config validation CLI in `src/cli/validate-config.ts` wiring `npm run config:validate`
- [X] T018 Implement secrets resolver with default env names and config overrides (FR-041) in `src/config/secrets.ts`
- [X] T019 Implement bounded retry utility (3 attempts, ~1s/2s/4s, skip 401/403, 60s cap) in `src/lib/retry.ts`
- [X] T020 Implement RunResult builder and stdout JSON emitter (FR-038) in `src/lib/run-result.ts`
- [X] T021 Implement timezone-aware timestamps and business-day calculations (FR-007, FR-014) in `src/lib/datetime.ts`
- [X] T022 Implement Jira REST client with auth-fail short-circuit (FR-037, FR-039) in `src/jira/client.ts`
- [X] T023 Implement scoped squad fetch — Scrum active+previous sprint, Kanban open+30d closed, 500-issue cap with truncation meta (FR-024, FR-042) in `src/jira/fetch-squad.ts`
- [X] T024 Implement Jira issue normalization to `NormalizedSquadSnapshot` (FR-024, data-model.md) in `src/jira/normalize.ts`
- [X] T025 Implement `--fixture` mode bypassing live Jira in `src/lib/fixture-mode.ts`
- [X] T026 [P] Create `storefront-sprint-active.json` anonymized fixture in `fixtures/jira/storefront-sprint-active.json`
- [X] T027 [P] Create `payments-mixed-boards.json` anonymized fixture in `fixtures/jira/payments-mixed-boards.json`
- [X] T028 [P] Create edge-case fixtures (stale, blocked, unassigned P0/P1, truncation >500, hygiene-only) in `fixtures/jira/`
- [X] T029 [P] Implement stale-in-progress delivery risk rule in `src/analysis/rules/stale-in-progress.ts`
- [X] T030 [P] Implement no-recent-update delivery risk rule in `src/analysis/rules/no-recent-update.ts`
- [X] T031 [P] Implement unowned-blocker delivery risk rule in `src/analysis/rules/unowned-blocker.ts`
- [X] T032 [P] Implement unassigned P0/P1-tier sprint work rule in `src/analysis/rules/unassigned-critical.ts`
- [X] T033 [P] Implement late-start and sprint-timing rules in `src/analysis/rules/late-start.ts`
- [X] T034 [P] Implement cross-squad dependency rule in `src/analysis/rules/cross-squad-dependency.ts`
- [X] T035 [P] Implement subtask inconsistency rule in `src/analysis/rules/subtask-inconsistency.ts`
- [X] T036 [P] Implement status thrash/reopen rule in `src/analysis/rules/status-thrash.ts`
- [X] T037 [P] Implement unplanned scope rule in `src/analysis/rules/unplanned-scope.ts`
- [X] T038 [P] Implement Jira hygiene findings module (FR-027, FR-028) in `src/analysis/rules/hygiene.ts`
- [X] T039 [P] Implement workload/flow signals module with neutral wording (FR-029, FR-032) in `src/analysis/rules/flow.ts`
- [X] T040 Implement squad health classifier (FR-015) in `src/analysis/health-classifier.ts`
- [X] T041 Implement deterministic analysis engine producing `DeterministicFindings` per squad (FR-026, FR-030) in `src/analysis/engine.ts`
- [X] T042 [P] Add config validation unit tests (alias overlap, missing board, actionable errors) in `tests/unit/config/validate.test.ts`
- [X] T043 [P] Add deterministic rule unit tests covering FR-046 scenarios (stale, hygiene-only On Track, 3+ risks At Risk, unowned P0/P1 blocker, WIP overload) in `tests/unit/analysis/`
- [X] T044 Add fixture pipeline integration test validating `DeterministicFindings` against schema in `tests/integration/fixture-pipeline.ts`

**Checkpoint**: Foundation ready — config validates offline, fixtures produce schema-valid deterministic findings

---

## Phase 3: User Story 1 — On-Demand Squad Analysis in Slack (Priority: P1) 🎯 MVP

**Goal**: Manager sends a Slack request naming one squad; assistant resolves squad/intent, analyzes Jira data, and posts a structured squad report to the triggering thread

**Independent Test**: Run `npm run analyze:fixture -- --squad storefront --intent full` and live on-demand against fixtures representing in-progress, blocked, stale, and unestimated items; verify required sections, health classification with rationale, evidence-backed risks with manager actions, and unknown-squad validation message (SC-001, SC-003)

### Implementation for User Story 1

- [X] T045 [P] [US1] Implement Slack request parser with squad resolution (FR-010, FR-012) and intent keyword precedence (FR-011) in `src/slack/parse-request.ts`
- [X] T046 [P] [US1] Add unit tests for squad resolution, intent precedence, unknown squad, and unrecognized intent in `tests/unit/slack/parse-request.test.ts`
- [X] T047 [US1] Implement shared report section helpers (list caps top 5, overflow line, data-limitations bullet list FR-025) in `src/report/sections.ts`
- [X] T048 [US1] Implement squad report renderer with fixed section order, timezone header timestamp, and explicit empty-section statements (FR-014, FR-033) in `src/report/render-squad-report.ts`
- [X] T049 [US1] Implement intent-filtered report composition (blockers, hygiene, stale, sprint, full) in `src/report/intent-filter.ts`
- [X] T050 [P] [US1] Add unit tests for section order, caps, overflow disclosure, and hygiene-not-downgrading-health in `tests/unit/report/render-squad-report.test.ts`
- [X] T051 [US1] Implement Slack `chat.postMessage` with thread reply and secret redaction (FR-036, FR-043) in `src/slack/post-message.ts`
- [X] T052 [US1] Implement on-demand CLI orchestration (load config → parse request → fetch/fixture → analyze → render → post → RunResult) in `src/cli/on-demand.ts`
- [X] T053 [US1] Implement offline fixture analyze CLI printing schema-valid findings/report JSON in `src/cli/analyze-fixture.ts` wiring `npm run analyze:fixture`
- [X] T054 [US1] Wire `npm run analyze:on-demand` script and CLI flags (`--text`, `--slack-channel`, `--thread-ts`, `--fixture`) in `package.json` and `src/cli/on-demand.ts`
- [X] T055 [US1] Create Cursor Automation agent instructions for on-demand Slack trigger in `prompts/automation/on-demand-instructions.md`
- [X] T056 [US1] Document Cursor Automation `slackTrigger` setup and smoke-test steps in `docs/automations/on-demand-slack.md`

**Checkpoint**: On-demand single-squad analysis works offline via fixtures and live via Slack automation

---

## Phase 4: User Story 2 — Daily Two-Squad Manager Briefing (Priority: P2)

**Goal**: Scheduled automation analyzes both squads and posts a private daily briefing to the manager destination with cross-squad priorities, partial-failure handling, and refresh labeling

**Independent Test**: Run `npm run analyze:daily -- --fixture` on a working day; verify two-squad structure (FR-017), no "since yesterday" on first run (FR-018), partial squad failure still delivers message (SC-005), and second same-day run labeled refresh (FR-018)

### Implementation for User Story 2

- [X] T057 [US2] Implement cross-squad priority detection (linked issues, cross-squad blocker owner, shared epic) ordered by impact (FR-017) in `src/analysis/cross-squad.ts`
- [X] T058 [P] [US2] Add unit tests for cross-squad priority kinds and ordering in `tests/unit/analysis/cross-squad.test.ts`
- [X] T059 [US2] Implement working-day and schedule guard using configured timezone (FR-008, FR-016) in `src/lib/schedule-guard.ts`
- [X] T060 [P] [US2] Add unit tests for working-day skip and default Mon–Fri 08:30 schedule in `tests/unit/lib/schedule-guard.test.ts`
- [X] T061 [US2] Implement daily two-squad briefing renderer with one-line squad status, cross-squad section, stand-up focus placeholder, refresh label, and per-squad unavailable markers (FR-017, FR-018, FR-019) in `src/report/render-daily-briefing.ts`
- [X] T062 [P] [US2] Add unit tests validating daily briefing aggregate against `daily-briefing.schema.json` shape in `tests/unit/report/render-daily-briefing.test.ts`
- [X] T063 [US2] Implement daily CLI orchestrating both squads with partial failure and RunResult emission in `src/cli/daily.ts`
- [X] T064 [US2] Wire `npm run analyze:daily` script and flags (`--fixture`, `--force`, `--refresh`) in `package.json` and `src/cli/daily.ts`
- [X] T065 [US2] Create Cursor Automation agent instructions for scheduled daily briefing in `prompts/automation/daily-instructions.md`
- [X] T066 [US2] Document Cursor Automation schedule trigger setup and smoke-test steps in `docs/automations/daily-briefing.md`

**Checkpoint**: Daily briefing delivers to manager destination only; one-squad failure does not block the other

---

## Phase 5: User Story 3 — Manager-Reviewed Follow-Up Drafts (Priority: P3)

**Goal**: Analysis produces copy-ready, recipient-grouped follow-up drafts with neutral tone and issue-key evidence; drafts are returned to the manager only and never auto-sent

**Independent Test**: Run `npm run analyze:fixture -- --squad payments --intent follow-up --include-drafts`; verify drafts grouped by recipient, cite issue keys, use neutral hygiene vs delivery framing, respect 10/20 caps (FR-022), and no team-member Slack DMs (SC-009)

### Implementation for User Story 3

- [X] T067 [US3] Create contextual analysis agent prompt consuming snapshot + deterministic findings in `prompts/contextual-analysis.md`
- [X] T068 [US3] Implement Zod validation and CLI for contextual analysis JSON (FR-047) in `src/ai/validate-contextual.ts` and `src/cli/validate-contextual.ts`
- [X] T069 [P] [US3] Create sample contextual analysis fixture in `fixtures/ai/sample-contextual-analysis.json`
- [X] T070 [US3] Implement merge step combining deterministic findings with validated `ContextualAnalysis` without overriding health classification in `src/ai/merge-contextual.ts`
- [X] T071 [US3] Implement recipient-grouped draft formatter (FR-020, FR-021, FR-022) in `src/report/group-drafts.ts`
- [X] T072 [P] [US3] Add unit tests for draft grouping, cap overflow line, and hygiene-vs-delivery wording in `tests/unit/report/group-drafts.test.ts`
- [X] T073 [US3] Integrate follow-up draft sections into squad report renderer in `src/report/render-squad-report.ts`
- [X] T074 [US3] Integrate follow-up draft sections (max 20) and stand-up focus items into daily briefing renderer in `src/report/render-daily-briefing.ts`
- [X] T075 [US3] Wire `--include-drafts` flag through fixture and live CLI paths in `src/cli/analyze-fixture.ts` and `src/cli/on-demand.ts`

**Checkpoint**: Follow-up drafts appear in both on-demand and daily outputs; manager-only delivery enforced

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Schema alignment, failure-path coverage, documentation, and quickstart verification

- [X] T076 [P] Extend `normalized-squad-snapshot.schema.json` optional fields (`labels`, `components`, `blockerMentionInComments`, `latestCommentExcerpt`) in `specs/001-em-copilot/contracts/normalized-squad-snapshot.schema.json` and mirror in `src/contracts/normalized-squad-snapshot.ts`
- [X] T077 [P] Add integration tests for Jira auth failure and Slack post failure RunResult codes in `tests/integration/failure-paths.test.ts`
- [X] T078 Add Kanban-vs-Scrum board separation and sprint-ended explicit messaging in report key-facts section in `src/report/render-squad-report.ts`
- [X] T079 Create operator overview linking config, automations, and troubleshooting in `docs/em-copilot.md`
- [X] T080 Run full `npm test` suite and fix any failures across `tests/`
- [X] T081 Execute quickstart.md validation scenarios (sections 1–7) and update steps if CLI flags diverge in `specs/001-em-copilot/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **User Story 1 (Phase 3)**: Depends on Foundational — MVP delivery path
- **User Story 2 (Phase 4)**: Depends on Foundational; integrates US1 analysis/report primitives
- **User Story 3 (Phase 5)**: Depends on Foundational; integrates into US1 and US2 renderers (T073, T074)
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependency on US2/US3
- **US2 (P2)**: Can start after Phase 2 — reuses analysis engine and Slack post from US1; independently testable via `--fixture`
- **US3 (P3)**: Can start after Phase 2 — enhances US1/US2 output; independently testable via `--include-drafts` on fixture CLI

### Within Each User Story

- Parser/renderer unit tests marked [P] can run in parallel with each other once interfaces are defined
- CLI orchestration tasks depend on their story's core modules
- Automation docs depend on working npm scripts

### Parallel Opportunities

- **Phase 1**: T004, T005 in parallel after T001–T003
- **Phase 2**: T008–T014 (Zod contracts), T026–T028 (fixtures), T029–T039 (rule modules), T042–T043 (tests) — all [P] within Phase 2 once T015–T025 land
- **Phase 3**: T045–T046 and T050 in parallel; T047 before T048
- **Phase 4**: T058 and T060 in parallel after T057/T059
- **Phase 5**: T069 and T072 in parallel
- **Phase 6**: T076 and T077 in parallel

---

## Parallel Example: User Story 1

```bash
# After Phase 2 completes, launch parser and report tests together:
Task T045: "Implement Slack request parser in src/slack/parse-request.ts"
Task T046: "Add unit tests in tests/unit/slack/parse-request.test.ts"
Task T050: "Add unit tests in tests/unit/report/render-squad-report.test.ts"

# Then wire CLI (sequential):
Task T052: "Implement on-demand CLI in src/cli/on-demand.ts"
Task T054: "Wire npm run analyze:on-demand in package.json"
```

---

## Parallel Example: Foundational Rule Modules

```bash
# Launch all delivery-risk rule modules together (different files):
Task T029: "stale-in-progress in src/analysis/rules/stale-in-progress.ts"
Task T030: "no-recent-update in src/analysis/rules/no-recent-update.ts"
Task T031: "unowned-blocker in src/analysis/rules/unowned-blocker.ts"
Task T032: "unassigned-critical in src/analysis/rules/unassigned-critical.ts"
# ... through T039

# Then integrate:
Task T040: "health-classifier.ts"
Task T041: "engine.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: `npm test`, `npm run analyze:fixture -- --squad storefront --intent full`, live Slack smoke per quickstart §4
5. Demo on-demand squad analysis

### Incremental Delivery

1. Setup + Foundational → offline analysis proven
2. Add US1 → on-demand Slack reports (MVP)
3. Add US2 → daily two-squad briefing
4. Add US3 → AI-enhanced follow-up drafts and stand-up focus
5. Polish → failure paths, docs, quickstart sign-off

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (on-demand path)
   - Developer B: US2 (daily briefing) — can start cross-squad module early in Phase 2 tail
   - Developer C: US3 (AI contextual) — can start prompt/schema while US1 renderers stabilize
3. Integrate at T073/T074 when US1/US2 renderers are stable

---

## Notes

- [P] tasks = different files, no incomplete dependencies
- [Story] label maps task to user story for traceability
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No hosted backend, database, or Jira writes — constitutional boundary (FR-001, FR-004)
- SC-011 (30-minute manager time savings) is post-launch KPI — not a build task

---

## Task Summary

| Phase | Task IDs | Count |
|-------|----------|-------|
| Setup | T001–T007 | 7 |
| Foundational | T008–T044 | 37 |
| US1 On-demand (P1) | T045–T056 | 12 |
| US2 Daily briefing (P2) | T057–T066 | 10 |
| US3 Follow-up drafts (P3) | T067–T075 | 9 |
| Polish | T076–T081 | 6 |
| **Total** | **T001–T081** | **81** |

**Parallel opportunities**: 28 tasks marked [P]

**Suggested MVP scope**: Phase 1 + Phase 2 + Phase 3 (T001–T056) = 56 tasks

**Independent test criteria**:
- **US1**: Fixture/full intent report with all FR-014 sections; unknown squad validation; health + evidence
- **US2**: Two-squad daily briefing structure; partial failure; refresh label; no prior-run comparison
- **US3**: Recipient-grouped drafts with issue keys; 10/20 caps; manager-only delivery

**Blockers**: None — analysis.md Critical/High findings resolved; operational dependency on Cursor Automations Slack trigger documented in quickstart.md
