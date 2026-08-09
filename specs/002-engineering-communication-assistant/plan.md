# Implementation Plan: Engineering Communication Assistant (MVP)

**Branch**: `002-engineering-communication-assistant` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-engineering-communication-assistant/spec.md`

## Summary

Build a **Cursor-only** follow-up communication workflow that consumes EngPilot (001) squad analysis artifacts, converts eligible findings into numbered manager-review proposals, delivers **manager-approved** private Slack DMs to engineers, and summarizes replies back to the manager — with **no autonomous messaging**, **no Jira writes**, and **no performance scoring**.

**Technical approach**: Extend the existing TypeScript package with a blocking `followups:cycle` script invoked by a Cursor Automation `slackTrigger`. The script reads a gitignored **SquadAnalysisArtifact** emitted by 001, runs deterministic finding→proposal mapping (fully unit-tested), uses schema-validated AI prompts for draft wording and reply extraction, polls the manager Slack thread for text commands (`approve`, `edit`, `ignore`, `status`, `done`), sends DMs via `@slack/web-api`, and exits when the cycle closes.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (ESM) — inherit from 001

**Primary Dependencies**: Zod, `@slack/web-api`, Luxon, Ajv, Vitest — no new runtime dependencies

**Storage**: Gitignored `.squadpulse/analysis/{squadId}-latest.json` (001 output, 002 input); in-memory `FollowUpCycle` for poll-loop lifetime only. No database, queue, or cross-cycle state.

**Testing**: Vitest against `fixtures/analysis/` and `fixtures/followups/`; deterministic mapper, command parser, urgency/confidence, and reply classifier offline (FR-041)

**Target Platform**: Cursor Automation `slackTrigger` on manager destination → `npm run followups:cycle` with blocking thread poll loop

**Project Type**: CLI modules in existing `squadpulse-em-copilot` package — not a hosted service

**Performance Goals**: Proposal preview < 30s; DM batch for ≤10 proposals < 2 min; default cycle poll window 60 min

**Constraints**: Cursor-only runtime; text commands only (no Block Kit interactivity); Jira read-only; manager approval gate on every send; ≤10 proposals/cycle; English en-US MVP

**Scale/Scope**: 1 manager, 2 squads (001 config), one squad per `/followups` invocation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Pre-Design | Post-Design | Notes |
|-----------|------------|-------------|-------|
| I. Cursor-Only Runtime | ✅ Pass | ✅ Pass | slackTrigger + blocking script poll; no hosted listener |
| II. Narrow Scope | ✅ Pass | ✅ Pass | Jira read + Slack only; builds on 001 analysis; no ADO/PR |
| III. No Surveillance | ✅ Pass | ✅ Pass | No rankings, scores, or reply-latency metrics (FR-033) |
| IV. Evidence Before Conclusions | ✅ Pass | ✅ Pass | Proposals cite artifact findings + Jira keys (FR-012) |
| V. Human-Controlled Communication | ✅ Pass | ✅ Pass | Approve gate on every DM; reply never auto-sends (FR-003, FR-029) |
| VI. Action-Oriented Reporting | ✅ Pass | ✅ Pass | Numbered proposals + concise reply summary |
| VII. Configuration Over Hardcoding | ✅ Pass | ✅ Pass | `communicationAssistant.*` keys in em-copilot.yml |
| VIII. Safe Read-First Integrations | ✅ Pass | ✅ Pass | Jira read-only; Slack DM read for replies only |
| IX. Lightweight Reliability | ✅ Pass | ✅ Pass | Bounded retry, per-proposal failure isolation (FR-038) |
| X. Testable Rules + Structured AI | ✅ Pass | ✅ Pass | Mapper/classifier unit tests + Zod schemas (FR-041, FR-042) |
| XI. Repository as Source of Truth | ✅ Pass | ✅ Pass | Contracts, prompts, fixtures, automation docs in repo |
| XII. Incremental E2E Delivery | ✅ Pass | ✅ Pass | Slices P1→P2→P3 mapped to vertical npm entry |

**Gate result**: PASS — no constitutional exceptions required.

## Project Structure

### Documentation (this feature)

```text
specs/002-engineering-communication-assistant/
├── plan.md              # This file
├── research.md          # Phase 0 — tech decisions
├── data-model.md        # Phase 1 — entities
├── quickstart.md        # Phase 1 — validation guide
├── contracts/           # Phase 1 — JSON Schema contracts
├── spec.md
├── autopilot-assumptions.md
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root — additive to 001)

```text
config/
└── em-copilot.yml                    # + communicationAssistant block

.squadpulse/                          # gitignored runtime
├── analysis/{squadId}-latest.json    # written by 001, read by 002
└── cycles/                           # optional crash snapshots (deleted on cycle end)

src/
├── followups/
│   ├── map-findings-to-proposals.ts  # deterministic FR-010–013, FR-017–018, FR-031
│   ├── assign-confidence-urgency.ts
│   ├── cycle-state.ts                # FollowUpCycle in-memory model
│   ├── process-manager-command.ts    # approve/edit/ignore/status/done
│   ├── render-cycle-preview.ts
│   ├── render-delivery-summary.ts
│   ├── render-reply-summary.ts
│   └── summarize-replies.ts          # reply classifier + AI merge
├── slack/
│   ├── parse-followup-request.ts     # follow-up intents (separate from analysis parse)
│   ├── dm-deliver.ts                 # open DM + post + read replies
│   └── poll-thread.ts                # manager thread poll loop
├── analysis/
│   └── write-artifact.ts             # 001 extension: emit SquadAnalysisArtifact
├── ai/
│   ├── validate-followup-proposal.ts
│   └── validate-reply-summary.ts
├── contracts/
│   ├── squad-analysis-artifact.ts
│   ├── follow-up-cycle.ts
│   ├── follow-up-proposal.ts
│   ├── follow-up-slack-request.ts
│   └── reply-summary.ts
└── cli/
    └── followups-cycle.ts            # npm run followups:cycle

prompts/
├── followup-draft-compose.md
├── reply-extract.md
└── automation/
    └── followups-instructions.md

fixtures/
├── analysis/
│   └── orion-mixed-findings.json
└── followups/
    ├── command-transcript-approve.json
    └── engineer-replies.json

docs/automations/
└── followups-slack.md

tests/
├── unit/followups/
└── unit/slack/
```

**Structure Decision**: Single TypeScript package extension — no new package or backend service. Follow-up modules live under `src/followups/` to keep 001 analysis/report paths stable.

## Architecture

```text
┌──────────────────────────┐
│ Cursor Automation        │
│ slackTrigger (manager DM)│
│ filter: followups intent │
└────────────┬─────────────┘
             │ npm run followups:cycle -- --text ... --poll
             ▼
    parse-followup-request (startCycle)
             ▼
    load SquadAnalysisArtifact (.squadpulse/analysis/{squadId}-latest.json)
             │ missing → ask manager to run analyze first (FR-037)
             ▼
    map-findings-to-proposals (deterministic, tested)
             ▼
    AI compose drafts (prompt + Zod validate)
             ▼
    render cycle preview → post to manager thread
             ▼
    ┌── poll loop (same process) ──────────────────────┐
    │  read thread replies every 5s                     │
    │  approve/edit/ignore → send DMs (dm-deliver)      │
    │  status → read engineer DM replies → summary      │
    │  done → exit                                      │
    └───────────────────────────────────────────────────┘
             ▼
    emit FollowUpRunResult JSON
```

### Workflow mapping

| User Story | Script phase | Key modules | Output |
|------------|--------------|-------------|--------|
| P1 Approve & send | start + poll (approve commands) | `map-findings-to-proposals`, `dm-deliver`, `process-manager-command` | Cycle preview + DM delivery summary |
| P2 Reply summary | poll (`status` command) | `summarize-replies`, `render-reply-summary` | Per-engineer reply summary |
| P3 Cycle context | poll (`draft another <n>`) | `cycle-state`, AI compose with prior Q&A | Continuation drafts referencing prior answers |

### Deterministic vs AI boundary

| Concern | Owner |
|---------|-------|
| Finding eligibility, reason type, recipient, de-duplication | Deterministic mapper (tested) |
| Confidence & urgency assignment | Deterministic rules (tested) |
| Engineer DM draft wording | AI + schema validation |
| Reply extraction & recommendation | Deterministic classifier first; AI for ambiguous cases |
| Preview/summary rendering, caps, overflow lines | Report renderers (deterministic) |
| Manager command parsing | Deterministic parser (tested) |

### Coordination with feature 001

| Change in 001 | Purpose |
|---------------|---------|
| `src/analysis/write-artifact.ts` | Write `SquadAnalysisArtifact` on successful analyze paths |
| `config/em-copilot.schema.json` | Optional `communicationAssistant` block |
| `RunResult.workflow` enum | Add `followups` value in 002 contract (001 unchanged at runtime) |

## Phase 0 Output

See [research.md](./research.md) — all Technical Context unknowns resolved, including analysis artifact bridge, poll-loop cycle orchestration, and finding→reason-type mapping.

## Phase 1 Output

- [data-model.md](./data-model.md) — entities, validation, state transitions
- [contracts/](./contracts/) — JSON Schema for artifact, cycle, proposals, commands, reply summary
- [quickstart.md](./quickstart.md) — offline and live validation scenarios

## Implementation Slices (for tasks phase)

1. **Foundation**: config extension, artifact contract, 001 artifact writer, gitignore `.squadpulse/`
2. **Deterministic core**: finding→proposal mapper, confidence/urgency, de-duplication, unit tests
3. **Slack commands**: parse-followup-request, process-manager-command, preview renderer
4. **P1 delivery**: dm-deliver, approval batch send, delivery summary, poll loop skeleton
5. **AI drafts**: followup-draft-compose prompt, Zod validation, language guard checks
6. **P2 replies**: DM reply read, summarize-replies, status command, reply summary renderer
7. **P3 context**: in-cycle askedPairs/capturedReplies, continuation draft path
8. **Automation docs**: `docs/automations/followups-slack.md`, quickstart verification

## Complexity Tracking

> No constitutional violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Blockers

**None.** Plan phase complete. Proceed to `/speckit-analyze` and `/speckit-tasks`.

**Operational dependencies (non-blocking)**:
- Feature 001 must emit `SquadAnalysisArtifact` (small additive change — tracked in slice 1).
- Slack bot needs `im:write` + `im:history` scopes in addition to 001 `chat:write`.
- Cursor Automation must allow blocking runs up to `cycleMaxMinutes` (default 60).
