# Autopilot Assumptions

**Feature**: `001-em-copilot` — Engineering Manager Copilot (MVP)
**Session**: 2026-08-06
**Mode**: Full-auto (no user prompting)
**Basis for defaults**: `.specify/memory/constitution.md` (v1.0.0), the feature description, existing `spec.md`, and standard engineering practice where the constitution and spec are silent.

Each assumption below has been encoded into `spec.md` and is cross-referenced to the specific FR(s) it updated. See `spec.md` → `## Clarifications` → `### Session 2026-08-06` for the mirrored Q → A bullets.

| # | Topic | Question / Gap | Assumption chosen | Confidence |
|---|-------|----------------|-------------------|------------|
| 1 | Health classification boundaries | The spec listed `On Track` / `Needs Attention` / `At Risk` (FR-015) without stating the rules that move between them. | `On Track` when no delivery risks are present; `Needs Attention` when 1–2 delivery risks are present AND no unowned P0/P1 blocker exists AND no unassigned P0/P1-tier sprint work after 50% of the sprint has elapsed; `At Risk` when ≥3 delivery risks are present OR any unowned P0/P1 blocker exists OR any P0/P1-tier sprint work remains unassigned after 50% of the sprint has elapsed. Hygiene findings never affect classification (Constitution IV + FR-028). Encoded in FR-015. | med |
| 2 | Daily briefing default schedule | FR-016 says "before stand-up" and FR-008 said the schedule is configured, but no default existed. | Default Monday–Friday at 08:30 in the configured timezone. Always overridable via configuration. Encoded in FR-008, FR-016. | med |
| 3 | Intent and squad-name parsing | FR-010/FR-011 named intents and squad resolution but did not specify matching rules (case, whitespace, fuzzy). | Case-insensitive, whitespace-collapsed, tolerant of trailing punctuation. Intent matched by presence of documented keywords (`analyze`/`full`, `sprint`, `blockers`, `stale`, `hygiene`, `follow-up`); most specific keyword wins; no fuzzy scoring. Squad matched by exact normalized-token comparison against display name or aliases. Encoded in FR-010, FR-011, FR-012. | high |
| 4 | Data retrieval scope and cap | FR-024 listed fields to retrieve but not the JQL scope or an upper bound on issues per run. | Scrum board → current active sprint + immediately preceding sprint (for carryover). Kanban board → all open issues + those closed within the last 30 days. Cap 500 issues per squad per run; overflow disclosed under Data limitations. Chosen to bound Jira API cost and Slack message size while covering carryover analysis. Encoded in FR-024, Edge Cases. | med |
| 5 | Squad identity resolution & alias uniqueness | Aliases could theoretically collide across squads; matching rules were implicit. | Exact case-insensitive comparison of the whitespace-collapsed request token against display name or aliases. Configuration validation MUST reject overlapping aliases across the two squads. Encoded in FR-010, FR-009. | high |
| 6 | Report compact limits (Slack length) | Slack messages have practical length limits; the spec did not cap sections. | Top 5 items per section (delivery risks, blockers, workload/flow, hygiene, manager actions) per squad report. Top 10 follow-up drafts per squad report; 20 across a daily two-squad briefing. Overflow disclosed as a single trailing "N additional …" line. Encoded in FR-014, FR-022, Edge Cases. | med |
| 7 | Report and draft language | Already noted in Assumptions but not tied to a testable FR. | English (en-US) for MVP; localization deferred (out of scope). Reinforced via cross-reference from Clarifications to Assumptions; no FR change required. | high |
| 8 | Timezone handling | FR-008 mentioned schedule but not timezone; FR-014 did not fix a timestamp format. | Configurable timezone at the top level (per-squad override permitted); default UTC. Timestamps rendered in ISO 8601 with an explicit offset (e.g. `2026-08-06 08:30 UTC+03:00`). Encoded in FR-008, FR-014. | med |
| 9 | Concurrent automation behavior | Duplicate on-demand requests were addressed; duplicate daily runs and overlapping on-demand + daily runs were not. | Runs are independent and idempotent. A repeated daily automation for the same working day and destination posts a briefing labeled "refresh"; on-demand analysis requests are never coalesced. Encoded in FR-018, Edge Cases. | med |
| 10 | Secret naming conventions | FR-041 said "Cursor-supported secret or environment mechanisms" but named no variables. | Default names: `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `SLACK_BOT_TOKEN`. Overridable via configuration; always resolved through Cursor-supported mechanisms; never committed. Encoded in FR-041. | med |
| 11 | Partial/empty board configuration | FR-005 permitted "optional" Scrum and Kanban but did not forbid a squad with neither. | Configuration validation MUST reject a squad with no board reference at all; at least one of Scrum or Kanban MUST be configured per squad. Encoded in FR-005, FR-009, Edge Cases. | high |
| 12 | Default working days | FR-008 referenced working-day configuration without a default. | Default working days = Monday through Friday; configurable at the top level (per-squad override permitted through FR-007). Encoded in FR-008. | high |
| 13 | Default per-squad thresholds | FR-007 required thresholds but did not supply defaults for teams that omit them. | Stale-in-progress = 5 business days; no-meaningful-update = 3 business days; max simultaneous in-progress items per person = 3. Squad configuration always overrides. Encoded in FR-007. | med |
| 14 | Follow-up draft cap | FR-020/FR-022 required drafts and grouping but not a maximum count. | 10 drafts max per squad report; 20 max per daily briefing; overflow disclosed with a trailing count line. Encoded in FR-022. | med |
| 15 | Retry policy bounds | FR-039 allowed "bounded retries" but did not bound them. | Up to 3 attempts per external call with ~exponential backoff (1s, 2s, 4s); no retries for auth failures; total wall-clock ≤ 60s per external call chain. Encoded in FR-039. | med |
| 16 | Slack posting failure surfacing | FR-038 required an inspectable execution result but did not specify the mechanism. | Non-success status with a machine-readable failure reason in the Cursor run history; no autonomous retry to an alternate destination. Encoded in FR-038. | med |
| 17 | Cross-squad priorities definition | FR-017 referenced "top cross-squad priorities" but did not define them. | Cross-squad priorities = issue links crossing the two squads, blockers whose owner is on the other squad, or a shared parent epic containing risk-classified work in both squads. Ordered by aggregate impact. Encoded in FR-017. | med |
| 18 | Data-limitations disclosure format | Referenced across FRs and Edge Cases but the format was not standardized. | Dedicated bullet list at the end of the affected report (or per-squad section within the daily briefing); each bullet names scope (field, board, squad) and a short non-secret reason phrase; never includes raw error payloads. Encoded in FR-025. | med |
| 19 | Report timestamp format | FR-014 referenced an "analysis timestamp" without a format. | ISO 8601 in the manager's configured timezone with an explicit offset. Encoded in FR-014. | med |
| 20 | Individual performance data | Constitutional (Principle III + FR-032) already prohibits ranking/scoring; reaffirmed here because the health-boundary rules count risks, not people. | Health boundaries operate over risk counts and evidence signals only; no rule increments health severity based on an individual's ticket count, story-point sum, or activity frequency. No FR change required. | high |

## Plan Phase Additions (2026-08-06)

The following technology choices were introduced during `/speckit-plan` and are not explicitly named in the constitution. They align with Principles I, X, and XI (Cursor-only, testable rules, repository source of truth).

| # | Topic | Decision | Rationale | Confidence |
|---|-------|----------|-----------|------------|
| 21 | Implementation language | TypeScript 5.x on Node.js 20 LTS (ESM) | JSON-schema validation (Zod), strong typing for rules, Vitest fixtures, native `fetch` for Jira REST | high |
| 22 | Config file format | YAML at `config/em-copilot.yml` validated by JSON Schema (Ajv) | Human-editable squad/board config; schema artifact in `contracts/` | high |
| 23 | On-demand Slack trigger | Cursor Automation `slackTrigger` → npm script | Simplest Cursor-supported trigger per constitution; no Socket Mode listener | med |
| 24 | Daily schedule trigger | Cursor Automation cron schedule → `npm run analyze:daily` | Constitution requires Cursor Automations for scheduled work | med |
| 25 | Jira integration | Jira Cloud REST API v3 direct HTTP (Basic auth) | Read-only, no Forge/hosted app; scoped JQL per FR-024 | high |
| 26 | Slack integration | `@slack/web-api` (`chat.postMessage`) | Thread replies for on-demand; manager destination for daily | high |
| 27 | AI output validation | Zod schemas mirroring `contracts/contextual-analysis.schema.json` | FR-047 structured validation before Slack render | high |
| 28 | Timezone / business days | Luxon | ISO 8601 timestamps with offset; business-day stale thresholds | high |
| 29 | Report rendering | TypeScript section composer (no template engine) | Deterministic caps, sort order, overflow lines (FR-014) | med |
| 30 | Retry utility | Shared exponential backoff (1s/2s/4s, max 3, 60s cap) | FR-039; no retry on auth failure | high |

## Blockers

None. All autopilot assumptions were resolvable via the constitution, the existing spec, or standard engineering practice. The clarify and plan phases completed without any hard blockers.

## Analyze Phase Self-Fixes (2026-08-06)

The following issues were detected during `/speckit-analyze` and corrected in-place before proceeding to `/speckit-tasks`.

| # | Finding | Severity (pre-fix) | Fix applied | Artifacts updated |
|---|---------|-------------------|-------------|-------------------|
| 31 | SC-012 required adding a third fixture squad, contradicting FR-005, config schema (`maxItems: 2`), and Constitution Principle II (exactly two squads). | Critical | Rewrote SC-012 to verify configurability via alias/threshold/mapping changes within the two-squad limit; explicitly noted third squad remains out of scope. | `spec.md` |
| 32 | FR-015/FR-026 and edge cases used "critical/high-priority" without mapping to internal `P0`/`P1` tiers from `priorityMapping`, creating conflicting implementation rules vs blocker gates. | High | Standardized health and delivery-risk language to "P0- or P1-tier" with explicit reference to `priorityMapping`. | `spec.md`, `data-model.md` |
| 33 | Daily briefing aggregate (`CrossSquadPriority`, per-squad failure, refresh label) had no JSON Schema contract despite FR-017/FR-018 and `data-model.md` definitions. | High | Added `contracts/daily-briefing.schema.json` and updated contracts README. | `contracts/daily-briefing.schema.json`, `contracts/README.md` |
| 34 | FR-011 stated "most specific intent wins" but did not define precedence order, making multi-keyword requests untestable. | High | Added fixed precedence chain: `follow-up` → `hygiene` → `stale` → `blockers` → `sprint` → `full`. | `spec.md`, `research.md` |
