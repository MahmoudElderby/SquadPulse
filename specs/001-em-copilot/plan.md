# Implementation Plan: Engineering Manager Copilot (MVP)

**Branch**: `001-em-copilot` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-em-copilot/spec.md`

## Summary

Build a **Cursor-only** engineering-manager assistant that reads Jira for two configurable squads and delivers evidence-backed Slack reports. The MVP delivers three vertical slices: on-demand single-squad analysis (P1), daily two-squad briefing (P2), and manager-reviewed follow-up drafts (P3).

**Technical approach**: TypeScript/Node repository scripts perform config validation, Jira fetch/normalization, and **deterministic rule analysis** (fully unit-tested against fixtures). A Cursor Automation/Agent prompt performs **AI contextual enrichment** (follow-up wording, stand-up focus) with **Zod-validated structured output** before Slack Markdown rendering. No hosted backend, database, or queue.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS (ESM)

**Primary Dependencies**: Zod (runtime validation), Ajv (config JSON Schema), Luxon (timezone/business days), `@slack/web-api`, Vitest

**Storage**: None — in-memory per run only (FR-003). No run-to-run persistence.

**Testing**: Vitest unit/integration tests against anonymized Jira fixtures in `fixtures/jira/`; schema contract tests for AI output

**Target Platform**: Cursor Automations (Slack trigger + schedule) invoking repo npm scripts; Cursor Cloud Agent for AI contextual phase

**Project Type**: CLI/library package invoked by Cursor Automations — not a standalone hosted service

**Performance Goals**: Complete two-squad analysis + Slack post in under 3 minutes wall-clock under normal Jira API latency; 500-issue cap per squad

**Constraints**: Cursor-only runtime; Jira + Slack read-only; two squads; deterministic rules testable offline; AI output schema-validated; secrets via env only

**Scale/Scope**: 1 manager, 2 squads, ≤500 issues/squad/run, 6 on-demand intents, daily briefing Mon–Fri default

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Pre-Design | Post-Design | Notes |
|-----------|------------|-------------|-------|
| I. Cursor-Only Runtime | ✅ Pass | ✅ Pass | Automations + scripts only; no hosted infra |
| II. Narrow Scope | ✅ Pass | ✅ Pass | Jira + Slack, two squads, MVP workflows only |
| III. No Surveillance | ✅ Pass | ✅ Pass | Flow signals neutral; no rankings in rules or schemas |
| IV. Evidence Before Conclusions | ✅ Pass | ✅ Pass | Risks require issue keys + evidence in schema |
| V. Human-Controlled Communication | ✅ Pass | ✅ Pass | Drafts to manager only; no auto-DM |
| VI. Action-Oriented Reporting | ✅ Pass | ✅ Pass | Fixed section order and caps in renderer |
| VII. Configuration Over Hardcoding | ✅ Pass | ✅ Pass | YAML config + JSON Schema contract |
| VIII. Safe Read-First Integrations | ✅ Pass | ✅ Pass | Jira read-only; scoped JQL |
| IX. Lightweight Reliability | ✅ Pass | ✅ Pass | Bounded retry + RunResult contract |
| X. Testable Rules + Structured AI | ✅ Pass | ✅ Pass | Vitest fixtures + contextual-analysis schema |
| XI. Repository as Source of Truth | ✅ Pass | ✅ Pass | Config, prompts, contracts, fixtures in repo |
| XII. Incremental E2E Delivery | ✅ Pass | ✅ Pass | Slices P1→P2→P3 mapped to npm scripts |

**Gate result**: PASS — no constitutional exceptions required.

## Project Structure

### Documentation (this feature)

```text
specs/001-em-copilot/
├── plan.md              # This file
├── research.md          # Phase 0 — tech decisions
├── data-model.md        # Phase 1 — entities
├── quickstart.md        # Phase 1 — validation guide
├── contracts/           # Phase 1 — JSON Schema contracts
├── spec.md
├── autopilot-assumptions.md
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
config/
├── em-copilot.example.yml
└── em-copilot.schema.json          # symlink or copy of contracts/config-schema.json

src/
├── index.ts
├── cli/
│   ├── on-demand.ts                # npm run analyze:on-demand
│   ├── daily.ts                    # npm run analyze:daily
│   └── validate-config.ts
├── config/
│   ├── load.ts
│   └── validate.ts                 # alias overlap, board presence
├── jira/
│   ├── client.ts                   # REST + retry
│   ├── fetch-squad.ts              # scoped retrieval FR-024
│   └── normalize.ts                # → NormalizedSquadSnapshot
├── analysis/
│   ├── rules/                      # deterministic rule modules
│   ├── health-classifier.ts
│   ├── cross-squad.ts
│   └── engine.ts
├── slack/
│   ├── parse-request.ts            # FR-010, FR-011
│   └── post-message.ts
├── report/
│   ├── render-squad-report.ts
│   └── render-daily-briefing.ts
├── ai/
│   └── validate-contextual.ts      # Zod validate FR-047
└── contracts/                      # Zod mirrors of contracts/*.json

prompts/
├── contextual-analysis.md          # Agent prompt template
└── automation/
    ├── on-demand-instructions.md
    └── daily-instructions.md

fixtures/
└── jira/
    ├── storefront-sprint-active.json
    ├── payments-mixed-boards.json
    └── ...

docs/
└── automations/
    ├── on-demand-slack.md          # Cursor Automation setup
    └── daily-briefing.md

tests/
├── unit/analysis/                  # deterministic rules
├── unit/slack/                     # request parsing
├── unit/report/                    # section order, caps
└── integration/fixture-pipeline.ts

package.json
tsconfig.json
vitest.config.ts
```

**Structure Decision**: Single TypeScript package at repo root. Cursor Automations invoke npm scripts; no separate backend service. Prompts and automation setup docs live in-repo (Constitution XI).

## Architecture

```text
┌─────────────────────┐     ┌──────────────────────┐
│ Cursor Automation   │     │ Cursor Automation    │
│ slackTrigger        │     │ schedule (cron)      │
└─────────┬───────────┘     └──────────┬───────────┘
          │                            │
          ▼                            ▼
   analyze:on-demand              analyze:daily
          │                            │
          └──────────┬─────────────────┘
                     ▼
            load + validate config
                     ▼
            fetch Jira (or --fixture)
                     ▼
            normalize → NormalizedSquadSnapshot
                     ▼
            deterministic rule engine → DeterministicFindings
                     ▼
            Cursor agent + prompts/contextual-analysis.md
                     ▼
            Zod validate → ContextualAnalysis
                     ▼
            render Slack Markdown
                     ▼
            post Slack + emit RunResult JSON
```

### Workflow mapping

| User Story | Entry script | Intent handling | Output |
|------------|--------------|-----------------|--------|
| P1 On-demand | `analyze:on-demand` | `parse-request.ts` | SquadReport to thread |
| P2 Daily | `analyze:daily` | both squads + cross-squad | DailyTwoSquadBriefing to manager DM/channel |
| P3 Drafts | both | AI contextual phase | FollowUpDraft sections in report |

### Deterministic vs AI boundary

| Concern | Owner |
|---------|-------|
| Delivery risks, hygiene, blockers, flow signals | Deterministic rules (tested) |
| Health classification | Deterministic only (FR-015) |
| Follow-up draft wording, stand-up focus | AI + schema validation |
| Section order, list caps, overflow lines | Report renderer (deterministic) |

## Phase 0 Output

See [research.md](./research.md) — all Technical Context unknowns resolved.

## Phase 1 Output

- [data-model.md](./data-model.md) — entities, validation, state transitions
- [contracts/](./contracts/) — JSON Schema for config, pipeline, daily briefing, and run results
- [quickstart.md](./quickstart.md) — offline and live validation scenarios

## Implementation Slices (for tasks phase)

1. **Foundation**: package scaffold, config load/validate, RunResult emission
2. **Jira layer**: fetch, normalize, fixtures, retry
3. **Rules engine**: all FR-026/027/029 rules + health classifier + tests
4. **On-demand path**: Slack parse, squad report render, on-demand automation docs
5. **AI contextual**: prompt, Zod validation, draft grouping
6. **Daily briefing**: cross-squad priorities, refresh label, schedule guard
7. **Operability**: example config, quickstart verification, automation setup docs

## Complexity Tracking

> No constitutional violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Blockers

**None.** Plan phase complete. Proceed to `/speckit-analyze` and `/speckit-tasks`.

**Operational dependency (non-blocking)**: Cursor Automations with Slack trigger must be enabled in the target workspace; documented in `quickstart.md` and future `docs/automations/`.
