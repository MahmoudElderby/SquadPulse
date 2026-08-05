# Research: Engineering Manager Copilot (MVP)

**Feature**: `001-em-copilot`  
**Date**: 2026-08-06  
**Status**: Complete — all Technical Context unknowns resolved

## Research Tasks & Outcomes

### 1. Runtime orchestration (Cursor-only boundary)

**Decision**: Three Cursor surfaces, each invoking the same repository entry scripts:

| Workflow | Cursor surface | Trigger | Entry point |
|----------|----------------|---------|-------------|
| On-demand squad analysis | Cursor Automation | `slackTrigger` on manager channel/DM | `npm run analyze:on-demand -- --text "<request>"` |
| Daily two-squad briefing | Cursor Automation | Schedule (cron: `30 8 * * 1-5` default, timezone-aware via config check inside script) | `npm run analyze:daily` |
| Deterministic rule tests / fixture runs | Local agent or CI | Manual / `npm test` | Vitest against fixtures |

The Cloud Agent / Automation **prompt** loads repo context, runs the npm script, validates structured output, posts to Slack via script, and exits with a machine-readable `RunResult` JSON on failure (FR-038).

**Rationale**: Constitution Principle I requires Cursor Automations for scheduled work and the simplest Cursor-supported Slack trigger for on-demand work. Repository scripts remain stateless helpers invoked by the agent — not a hosted service.

**Alternatives considered**:
- *Cursor SDK `@cursor/sdk` orchestrating everything* — rejected for MVP; adds API-key dependency and duplicates what Automations already provide for Slack/schedule triggers.
- *Agent-only with no scripts* — rejected; deterministic rules would not be independently testable (FR-046).

---

### 2. Implementation language and toolchain

**Decision**: **TypeScript 5.x on Node.js 20 LTS**, ESM modules, **Vitest** for tests, **Zod** for runtime schema validation.

**Rationale**:
- Strong typing for analysis rules and normalized Jira models.
- Zod validates AI contextual output before Slack render (FR-047).
- Vitest runs fast fixture-based unit tests without live Jira/Slack (FR-046, SC-014).
- Node `fetch` (built-in) avoids heavy HTTP dependencies.
- Aligns with Cursor agent workflows that commonly invoke `npm` scripts.

**Alternatives considered**:
- *Python* — viable but greenfield repo has no existing language signal; TypeScript pairs better with JSON-schema-heavy contracts.
- *Pure prompt-only (no TypeScript)* — fails testability gate.

---

### 3. Configuration format and validation

**Decision**: **YAML** configuration at `config/em-copilot.yml` validated at run start against **JSON Schema** (`config/em-copilot.schema.json`) using **Ajv**; squad/board overlap and alias uniqueness enforced in a dedicated validator module.

**Rationale**: Constitution Principle VII (configuration over hardcoding). YAML is human-editable for squad names, aliases, thresholds, and schedules. JSON Schema is the contract artifact in `contracts/`.

**Alternatives considered**:
- *JSON only* — less readable for managers editing squad config.
- *TOML* — less common in Node tooling.

---

### 4. Jira data retrieval

**Decision**: **Jira Cloud REST API v3** via direct HTTP (`/rest/api/3/search/jql`, board/sprint endpoints as needed). Authentication: Basic auth with `JIRA_EMAIL` + `JIRA_API_TOKEN`. Scoped JQL built from squad config (FR-024, FR-042).

Retrieval per squad:
- **Scrum**: active sprint + previous sprint issues (board-filtered).
- **Kanban**: `status != Done` OR `resolutiondate >= -30d`.
- Hard cap **500 issues** per squad; emit `DataLimitationNotice` on truncation.

**Rationale**: Read-only, least-privilege (Constitution VIII). No Jira SDK required — REST is sufficient and keeps dependencies minimal.

**Alternatives considered**:
- *Jira Forge app* — violates Cursor-only / no hosted backend.
- *GraphQL* — not uniformly available across Jira Cloud instances.

---

### 5. Slack integration

**Decision**: **Slack Web API** via `@slack/web-api` for posting messages. On-demand replies use `chat.postMessage` in the **triggering thread** (`thread_ts`). Daily briefing posts to configured manager destination (`channel` ID from config).

On-demand trigger: **Cursor Automation `slackTrigger`** listening on the manager's channel/DM; automation prompt passes message text to the entry script.

**Intent precedence** (when multiple keywords match): `follow-up` → `hygiene` → `stale` → `blockers` → `sprint` → `full` (FR-011).

**Rationale**: FR-043 (destination scoping), automate skill documents `slackTrigger` as the Cursor-native path. No Block Kit for MVP (spec assumption: Slack-friendly Markdown only).

**Alternatives considered**:
- *Slack Socket Mode standalone bot* — requires a persistent listener process (constitutional violation).
- *Incoming webhooks only* — cannot reply in thread for on-demand.

---

### 6. Analysis architecture (deterministic + AI)

**Decision**: **Two-phase pipeline**:

1. **Deterministic phase** (TypeScript, 100% unit-tested): normalize Jira issues → `NormalizedSquadSnapshot` → apply rule engine → `DeterministicFindings` (risks, hygiene, blockers, flow signals, health classification, cross-squad links).
2. **AI contextual phase** (Cursor agent prompt): consume snapshot + deterministic findings → produce `ContextualAnalysis` JSON (stand-up focus, follow-up draft wording, narrative framing) → **Zod validate** → merge → render Slack Markdown.

Health classification (`On Track` / `Needs Attention` / `At Risk`) is **deterministic only** (FR-015); AI must not override it.

**Rationale**: Constitution Principle X — predictable rules plus validated AI output.

**Alternatives considered**:
- *AI-only analysis* — fails evidence/traceability and testability gates.
- *Deterministic-only (no AI)* — acceptable for MVP slice 1 but insufficient for neutral follow-up draft wording and stand-up focus synthesis (User Story 3).

---

### 7. Report rendering

**Decision**: TypeScript **template composer** in `src/report/` using section builders (not a full templating engine). Section order and caps enforced in code (FR-014, FR-022). Output: Slack-flavored Markdown string.

**Rationale**: Keeps rendering deterministic and testable; avoids Handlebars logic duplication with caps/sorting rules.

**Alternatives considered**:
- *Handlebars/Mustache* — extra dependency; caps and sorting still need code.

---

### 8. Timezone and business-day calculations

**Decision**: **Luxon** for timezone-aware timestamps (ISO 8601 with offset per FR-014) and **business-day thresholds** (stale / no-update defaults in FR-007). Working-day schedule check for daily automation performed in script using configured timezone.

**Rationale**: Explicit timezone configuration (FR-008); business-day semantics for stale thresholds.

**Alternatives considered**:
- *Plain `Date`* — error-prone for timezones and business days.

---

### 9. Retry and failure handling

**Decision**: Shared `retryWithBackoff` utility — max 3 attempts, delays ~1s/2s/4s, skip on 401/403, 60s wall-clock cap per call chain (FR-039). Failures return structured `RunResult` with `status: "error"` and `reason` code for Cursor run history (FR-038).

**Rationale**: Constitution Principle IX.

---

### 10. Secrets resolution

**Decision**: Resolve from **environment variables** (Cursor Automation/Agent secret injection) with names defaulting to `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `SLACK_BOT_TOKEN`; overridable via config `secrets.envVarNames` (FR-041). Never read from committed files.

**Rationale**: Constitution VIII + FR-041. Cursor Automations support secret/env injection for repo scripts.

**Alternatives considered**:
- *`.env` file in repo* — security risk; rejected.

---

### 11. Fixture and offline testing strategy

**Decision**: Anonymized Jira JSON fixtures under `fixtures/jira/` representing each squad state. Tests call `normalizeIssues()` and rule functions directly. Optional `--fixture` flag on entry scripts bypasses live Jira (FR-046).

Live integration smoke tests documented in `quickstart.md` but not required for CI.

**Rationale**: SC-014, Constitution Principle X.

---

## Resolved NEEDS CLARIFICATION Items

| Item | Resolution |
|------|------------|
| Language/Version | TypeScript 5.x / Node 20 |
| Primary Dependencies | Zod, Ajv, Luxon, `@slack/web-api`, Vitest |
| Storage | None (in-memory per run only) |
| Testing | Vitest + fixture JSON |
| Target Platform | Cursor Automations + Cloud Agent on repo checkout |
| Project Type | CLI/library invoked by Cursor Automations |
| Performance Goals | Full two-squad run < 3 min wall-clock under normal Jira latency |
| Scale/Scope | 2 squads, ≤500 issues/squad/run, 1 manager |

## Remaining Implementation Risks (not blockers)

- **Cursor Automation Slack trigger availability** depends on workspace Automations being enabled; documented in `quickstart.md` setup steps.
- **Jira field variance** across instances handled via configurable field mappings and data-limitation disclosures (FR-025).
