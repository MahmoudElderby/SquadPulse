# Specification Analysis Report

**Feature**: `001-em-copilot` — Engineering Manager Copilot (MVP)  
**Date**: 2026-08-06  
**Phase**: `/speckit-analyze`  
**Model**: composer-2.5-fast  
**Artifacts analyzed**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/`, `autopilot-assumptions.md`, `.specify/memory/constitution.md`  
**Note**: `tasks.md` not yet generated — task coverage deferred to `/speckit-tasks`.

---

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation | Status |
|----|----------|----------|-------------|---------|----------------|--------|
| I1 | Inconsistency | Critical | spec.md SC-012 vs FR-005, config-schema.json, Constitution II | SC-012 required adding a third fixture squad, violating the two-squad MVP limit. | Rewrite SC-012 to test configurability within two squads only. | **Fixed** |
| I2 | Inconsistency | High | spec.md FR-015, FR-026; data-model.md | "Critical/high-priority" work was undefined vs internal P0–P4 tiers used for blocker gates. | Standardize on P0/P1 tier language tied to `priorityMapping`. | **Fixed** |
| U1 | Underspecification | High | contracts/, plan.md, FR-017 | No JSON Schema for daily briefing aggregate (cross-squad priorities, refresh, partial failure). | Add `daily-briefing.schema.json`. | **Fixed** |
| A1 | Ambiguity | High | spec.md FR-011, research.md | Intent precedence among six keywords was unspecified beyond one example. | Document fixed precedence chain in FR-011. | **Fixed** |
| E1 | Coverage | Medium | tasks.md (missing) | Task list not generated; cannot verify FR→task mapping yet. | Run `/speckit-tasks` before `/speckit-implement`. | Open (deferred) |
| U2 | Underspecification | Medium | normalized-squad-snapshot.schema.json vs data-model.md, FR-024 | Schema omits optional fields present in data model (e.g. `labels`, `components`, `blockerMentionInComments`, `latestCommentExcerpt`). | Extend schema during implement or tasks phase when rule modules are defined. | Open |
| U3 | Underspecification | Medium | contextual-analysis.schema.json | Schema describes but does not structurally enforce "must not override health classification." | Enforce in merge/validation code; optional future `healthStatus` cross-check field. | Open |
| U4 | Underspecification | Medium | contracts/ | No schema for rendered `SquadReport` Slack Markdown (only `DeterministicFindings`). | Acceptable for MVP; renderer tests cover section order/caps per plan. | Open |
| I3 | Inconsistency | Medium | plan.md vs spec.md | Performance goal "< 3 min two-squad run" appears only in plan Technical Context. | Add optional NFR note in tasks or accept as implementation target. | Open |
| A2 | Ambiguity | Low | spec.md FR-014 | Timestamp labeled "ISO 8601" but example uses space-separated format with `UTC+03:00` suffix. | Treat example as canonical display format; document in renderer. | Open |
| D1 | Duplication | Low | spec.md FR-014/FR-022 vs Edge Cases | Report caps repeated in FRs, clarifications, assumptions, and edge cases. | No action — intentional reinforcement. | Accepted |
| T1 | Terminology | Low | spec.md Key Entities | Delivery risk category still says "unassigned critical" in entity description. | Align wording to "unassigned P0/P1-tier" in a future spec polish. | Open |

**Overflow**: None (12 findings total, under 50 cap).

---

## Coverage Summary

`tasks.md` absent — requirement-to-task mapping deferred. Requirement inventory below supports the tasks phase.

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 … FR-048 | — | — | Plan slices 1–7 map conceptually; tasks pending |
| SC-001 … SC-010, SC-012 … SC-014 | — | — | Testable via quickstart + Vitest per plan |
| SC-011 | N/A | — | Post-launch manager self-report KPI; not a build task |
| User Story P1 (on-demand) | — | — | plan.md → slice 4 |
| User Story P2 (daily) | — | — | plan.md → slice 6 |
| User Story P3 (drafts) | — | — | plan.md → slice 5 |

**Estimated coverage after tasks phase**: Plan implementation slices explicitly cover all three user stories and FR-046/FR-047 test gates. Expect ≥90% FR coverage once tasks are generated.

---

## Constitution Alignment

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Cursor-Only Runtime | ✅ Pass | spec FR-001/FR-003; plan architecture; research decisions |
| II. Narrow Scope | ✅ Pass (after I1 fix) | SC-012 no longer implies third squad |
| III. No Surveillance | ✅ Pass | FR-032, SC-008; flow signals neutral in schemas |
| IV. Evidence Before Conclusions | ✅ Pass | FR-030, deterministic-findings schema requires evidence |
| V. Human-Controlled Communication | ✅ Pass | FR-020–FR-023, SC-009 |
| VI. Action-Oriented Reporting | ✅ Pass | FR-014, FR-017 section order |
| VII. Configuration Over Hardcoding | ✅ Pass | config-schema.json + FR-005–FR-009 |
| VIII. Safe Read-First | ✅ Pass | FR-004, FR-041, FR-042 |
| IX. Lightweight Reliability | ✅ Pass | FR-038, FR-039; run-result.schema.json |
| X. Testable Rules + Structured AI | ✅ Pass | FR-046, FR-047; fixture strategy in quickstart |
| XI. Repository Source of Truth | ✅ Pass | contracts, prompts, docs paths in plan |
| XII. Incremental E2E Delivery | ✅ Pass | P1→P2→P3 slices in plan |

**Constitution conflicts**: None remaining.

---

## Unmapped Tasks

Not applicable — `tasks.md` does not exist yet.

---

## Metrics

| Metric | Value |
|--------|-------|
| Total Functional Requirements | 48 |
| Total Success Criteria | 14 (13 build-verifiable; SC-011 post-launch) |
| Total User Stories | 3 |
| Total Tasks | 0 (pending `/speckit-tasks`) |
| Coverage % (requirements with ≥1 task) | N/A |
| Findings — Critical | 0 (1 fixed) |
| Findings — High | 0 (3 fixed) |
| Findings — Medium | 4 open |
| Findings — Low | 3 open |
| Duplication Count | 1 (accepted) |
| Ambiguity Count | 1 open (A2) |

---

## Self-Fixes Applied

See `autopilot-assumptions.md` → **Analyze Phase Self-Fixes (2026-08-06)** for the four Critical/High corrections applied during this run.

---

## Next Actions

1. **Proceed to `/speckit-tasks`** — no Critical or High blockers remain.
2. During tasks generation, ensure slices cover: config validation (SC-010), deterministic rule tests (SC-014), daily briefing contract validation, intent precedence unit tests, and both-squad partial-failure path (SC-005).
3. Optionally address Medium items U2–U4 during implement without blocking tasks.

**Blockers**: None.
