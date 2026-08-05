---
name: speckit-autopilot-review
description: Review-mode Spec Kit pipeline. Pauses on low-confidence clarifications,
  Critical/High analysis findings, and before implement. Dispatches each phase with
  models.yml model routing.
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: github-spec-kit
  source: autopilot:commands/review.md
---

# Autopilot (mode: review)

## User Input

```text
$ARGUMENTS
```

You **MUST** treat `$ARGUMENTS` as the feature request (what to build). If empty, ask the user for a one-sentence feature description and stop.

## Mode: REVIEW ON CLARIFY

You are running the Spec-Driven Development pipeline end-to-end **with human gates**. The user stays in the loop for ambiguity, serious consistency issues, and the go/no-go before code is written.

### Absolute rules

1. Execute the following core Spec Kit skills **IN ORDER**. Do not skip a phase.
2. Use the previous phase's artifact as input to the next.
3. After every phase transition, print exactly one status line:
   `[autopilot] <phase> <status> model=<model-id>`
   where `status` is `started` | `completed` | `paused` | `failed`.
4. On hard failure, print `[autopilot] <phase> failed`, explain, and **STOP**.
5. When pausing, print `[autopilot] <phase> paused`, list clear questions or findings, and **STOP waiting for user reply**. Do not continue until the user answers.
6. Never invent application code before the implement phase is approved.
7. **Model routing is mandatory** — same rules as full-auto (see below).

## Model routing (phase → model)

Load map from:

1. `.specify/extensions/autopilot/models.resolved.json` if present
2. Else `.specify/extensions/autopilot/models.yml` / extension `models.yml`
3. Else all phases = `inherit`

For each phase:

- `inherit` → run in parent
- concrete model id → Task/subagent with that model (prefer agent `speckit-<phase>` from `.cursor/agents/`)

If agents are missing, run:

```powershell
powershell -NoProfile -File ".specify\extensions\autopilot\scripts\Sync-ModelRouting.ps1"
```

Sync config edits with `/speckit-autopilot-sync-models`.

## Phase pipeline

Run each phase by following the installed core skill (`speckit-specify`, `speckit-clarify`, `speckit-plan`, `speckit-analyze`, `speckit-tasks`, `speckit-implement`) **on the model configured for that phase**.

#### 1. specify

```text
[autopilot] specify started model=<id>
```

- Follow `speckit-specify` with `$ARGUMENTS`.
- Create/update `specs/<slug>/spec.md`.

```text
[autopilot] specify completed model=<id>
```

#### 2. clarify — GATE A

```text
[autopilot] clarify started model=<id>
```

- Follow `speckit-clarify` on the clarify model.
- Separate questions into:
  - **high-confidence** — answer yourself only when constitution or explicit user text already settles it; still log to `specs/<slug>/autopilot-assumptions.md`.
  - **not high-confidence** — must involve the user.

**If any not-high-confidence questions exist:**

```text
[autopilot] clarify paused model=<id>
```

Present them as a numbered list with your suggested default for each. **STOP** and wait. After the user replies, apply answers to `spec.md`, update assumptions log, and continue.

**If all questions are high-confidence or none remain:**

```text
[autopilot] clarify completed model=<id>
```

#### 3. plan

```text
[autopilot] plan started model=<id>
```

- Follow `speckit-plan` on the plan model.
- Produce `plan.md` (+ research/design as required).

```text
[autopilot] plan completed model=<id>
```

#### 4. analyze — GATE B

```text
[autopilot] analyze started model=<id>
```

- Follow `speckit-analyze` on the analyze model; write/update `analysis.md`.

**If any Critical or High severity findings exist:**

```text
[autopilot] analyze paused model=<id>
```

List each finding with severity, offending artifact, and 1–2 proposed fixes. **STOP** for user decision. After the user replies, apply agreed fixes, re-run analysis checks, and only proceed when Critical/High are clear (or the user explicitly accepts residual risk — which you must log).

**If only Medium/Low/None:**

```text
[autopilot] analyze completed model=<id>
```

#### 5. tasks

```text
[autopilot] tasks started model=<id>
```

- Follow `speckit-tasks` on the tasks model to produce `tasks.md`.

```text
[autopilot] tasks completed model=<id>
```

#### 6. implement — GATE C (go/no-go)

```text
[autopilot] implement paused model=<id>
```

Before writing application source files, present a **go/no-go** summary:

- Feature directory
- Spec summary (stories + FRs count)
- Plan tech stack
- Task count by phase/story
- Model routing table for this run
- Open assumptions (if any)
- Ask: **Proceed with implementation? (yes / no / change X)**

**STOP** and wait for explicit yes (or equivalent affirmative). On no/change, stop or loop back only to the phases the user requests.

After approval:

```text
[autopilot] implement started model=<id>
```

- Follow `speckit-implement` on the implement model; run project tests when available.

```text
[autopilot] implement completed model=<id>
```

### Completion report

```markdown
## Autopilot complete (review)

- Feature dir: `specs/<slug>/`
- Models used: (per-phase table)
- Gates that paused: [list or none]
- Assumptions log: `specs/<slug>/autopilot-assumptions.md` (if any)
- Implementation: summary
- Tests: pass/fail summary
- Remaining human review: final diff + constitution check
```

Do not start unrelated work after the report.