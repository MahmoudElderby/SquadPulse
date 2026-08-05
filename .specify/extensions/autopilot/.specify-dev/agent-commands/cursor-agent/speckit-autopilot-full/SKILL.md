---
name: speckit-autopilot-full
description: Full-auto Spec Kit pipeline (specify → clarify → plan → analyze → tasks
  → implement). Auto-resolves clarifications; logs assumptions; stops only on hard
  errors. Dispatches each phase with models.yml model routing.
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: github-spec-kit
  source: autopilot:commands/run.md
---

# Autopilot (mode: full)

## User Input

```text
$ARGUMENTS
```

You **MUST** treat `$ARGUMENTS` as the feature request (what to build). If empty, ask the user for a one-sentence feature description and stop.

## Mode: FULL AUTO

You are running the Spec-Driven Development pipeline **end-to-end without pausing for user review**. The human will audit artifacts and code after the full run completes.

### Absolute rules

1. Execute the following core Spec Kit skills **IN ORDER**. Do not skip a phase.
2. Use the previous phase's artifact as input to the next.
3. After every phase, print exactly one status line:
   `[autopilot] <phase> <status> model=<model-id>`
   where `status` is `started` | `completed` | `failed`.
4. On hard failure (script error, missing template, unrecoverable validation), print `[autopilot] <phase> failed`, explain the error, and **STOP**. Do not invent missing artifacts.
5. Never invent application code before the implement phase. Artifact content must follow the skill's own instructions and templates.
6. Do not ask the user questions mid-pipeline. If something is ambiguous, choose a reasonable default and record it (see Clarify / Assumptions).
7. **Model routing is mandatory** (see below). Do not run every phase on the parent chat model when a phase map exists.

## Model routing (phase → model)

Load the phase model map **before** any phase:

1. Prefer `.specify/extensions/autopilot/models.resolved.json` if present (already expanded aliases).
2. Else read `.specify/extensions/autopilot/models.yml` or `extensions/speckit-autopilot/models.yml`.
3. Expand aliases with that file's `aliases` block (`opus-4.7`, `composer`, `inherit`, …).
4. If nothing is found, treat every phase as `inherit` (parent model).

**Execution rule for each phase:**

| Condition | How to run the phase |
|---|---|
| Resolved model is `inherit` | Run the phase skill **in this parent agent** |
| Resolved model is a concrete id | **Delegate** the phase to a Task/subagent using that model. Prefer the generated agent `.cursor/agents/speckit-<phase>.md` (name `speckit-<phase>`). If agents are missing, run `Sync-ModelRouting.ps1` once, then delegate. If Task unavailable, state the intended model in the status line and continue in-parent (degraded). |

Delegation prompt template for a phase worker:

```text
You are the Spec Kit <phase> worker. Follow .cursor/skills/speckit-<phase>/SKILL.md exactly.
Feature request / prior context:
<...include $ARGUMENTS, feature dir, and paths to prior artifacts...>
Do only this phase. Return: paths changed, brief summary, blockers.
```

Pass `model: <resolved-id>` when launching the Task/subagent (unless using a custom agent whose frontmatter already pins the model).

Phases in scope:

- constitution (only if constitution is still a template / user asked to refresh principles)
- specify → clarify → plan → analyze → tasks → implement
- optional if already part of your chain: checklist, converge

### Quick edit tip

Change `.specify/extensions/autopilot/models.yml` then run `/speckit-autopilot-sync-models`
(or `powershell -File .specify/extensions/autopilot/scripts/Sync-ModelRouting.ps1`).

Recommended defaults:

| Phase | Default alias |
|-------|---------------|
| constitution, specify, clarify | `opus-4.7` |
| plan, analyze, tasks, implement | `composer` |

## Phase pipeline

Skill files (for workers to follow):

- `.cursor/skills/speckit-specify/SKILL.md`
- `.cursor/skills/speckit-clarify/SKILL.md`
- `.cursor/skills/speckit-plan/SKILL.md`
- `.cursor/skills/speckit-analyze/SKILL.md`
- `.cursor/skills/speckit-tasks/SKILL.md`
- `.cursor/skills/speckit-implement/SKILL.md`

#### 1. specify

```text
[autopilot] specify started model=<id>
```

- Input: the user's raw request (`$ARGUMENTS`).
- Delegate/run with the **specify** model: create feature directory under `specs/`, write `spec.md`.
- Note the feature directory path for later phases.

```text
[autopilot] specify completed model=<id>
```

#### 2. clarify

```text
[autopilot] clarify started model=<id>
```

- Follow `speckit-clarify` against the new/updated `spec.md`.
- **AUTO-ANSWER** every underspecified item and every `[NEEDS CLARIFICATION]` marker using high-quality, constitution-aligned defaults derived from:
  - `.specify/memory/constitution.md`
  - the feature description
  - any existing plan/research if present
  - common engineering standards when the project is silent
- Update `spec.md` so **no** `[NEEDS CLARIFICATION]` markers remain.
- Create/append `specs/<slug>/autopilot-assumptions.md` with a table:

```markdown
# Autopilot Assumptions

| # | Topic | Question / Gap | Assumption chosen | Confidence |
|---|-------|----------------|-------------------|------------|
| 1 | ...   | ...            | ...               | high/med/low |
```

- Every auto-answer must appear in this file. Prefer `high` only when constitution or explicit user text supports it; otherwise mark `med` or `low`.

```text
[autopilot] clarify completed model=<id>
```

#### 3. plan

```text
[autopilot] plan started model=<id>
```

- Follow `speckit-plan` with the **plan** model. Prefer tech stack already implied by the constitution; if none, choose the simplest viable stack and log it in `autopilot-assumptions.md`.
- Produce `plan.md` and any Phase 0/1 research/design files the skill requires.

```text
[autopilot] plan completed model=<id>
```

#### 4. analyze

```text
[autopilot] analyze started model=<id>
```

- Follow `speckit-analyze` with the **analyze** model.
- Write/update `analysis.md`.
- If Critical or High findings appear, **fix them yourself** by editing the offending artifacts (spec/plan/tasks inputs), re-check, and only proceed when no Critical/High remain — unless a finding is unfixable without user data; then STOP with `failed` and list what you need.
- Record self-fixes under Autopilot Assumptions.

```text
[autopilot] analyze completed model=<id>
```

#### 5. tasks

```text
[autopilot] tasks started model=<id>
```

- Follow `speckit-tasks` with the **tasks** model to produce an actionable `tasks.md`.

```text
[autopilot] tasks completed model=<id>
```

#### 6. implement

```text
[autopilot] implement started model=<id>
```

- Follow `speckit-implement` with the **implement** model.
- Run available automated tests when the project has a clear test entry point.

```text
[autopilot] implement completed model=<id>
```

### Completion report

After the last successful phase, print a short report:

```markdown
## Autopilot complete (full)

- Feature dir: `specs/<slug>/`
- Models used:
  - specify: <id>
  - clarify: <id>
  - plan: <id>
  - analyze: <id>
  - tasks: <id>
  - implement: <id>
- Spec / plan / analysis / tasks: ready
- Assumptions log: `specs/<slug>/autopilot-assumptions.md`
- Implementation: summary of what changed
- Tests: pass/fail summary
- Human review checklist:
  1. Read autopilot-assumptions.md (esp. low/med confidence)
  2. Diff implementation against acceptance scenarios in spec.md
  3. Confirm constitution compliance
```

Do not start unrelated work after the report.