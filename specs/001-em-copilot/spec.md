# Feature Specification: Engineering Manager Copilot (MVP)

**Feature Branch**: `001-em-copilot`

**Created**: 2026-08-06

**Status**: Draft

**Input**: User description: "Build the first product specification for **Engineering Manager Copilot**, a Cursor-only AI assistant that helps an engineering manager manage two software-development squads by analyzing Jira data and delivering actionable results through Slack."

## Clarifications

### Session 2026-08-06

The following clarifications were resolved by the Spec Kit autopilot using constitution-aligned defaults. Each answer is recorded here and integrated into the sections listed. See `autopilot-assumptions.md` for the confidence rating of each assumption.

- Q: What rule set moves overall squad health between `On Track`, `Needs Attention`, and `At Risk`? → A: `On Track` when no delivery risks exist; `Needs Attention` when 1–2 delivery risks exist with no unowned P0/P1 blocker and no unassigned P0/P1-tier sprint work after 50% of the sprint has elapsed; `At Risk` when ≥3 delivery risks exist, or any unowned P0/P1 blocker exists, or any P0/P1-tier sprint work remains unassigned after 50% of the sprint has elapsed. Hygiene findings never influence classification. (Integrated into FR-015.)
- Q: What is the default daily-briefing schedule when no schedule is configured? → A: Monday through Friday at 08:30 in the configured timezone (defaulting to UTC when the timezone is also unset). Always overridable via configuration. (Integrated into FR-008 and FR-016.)
- Q: How are Slack squad names and intents parsed from free-text requests? → A: Case-insensitive, whitespace-tolerant, tolerant of trailing punctuation; intents are matched by presence of documented keyword phrases (`analyze`, `blockers`, `hygiene`, `stale`, `follow-up`, `sprint`, `full`); when multiple keywords match, fixed precedence applies (`follow-up` → `hygiene` → `stale` → `blockers` → `sprint` → `full`); no fuzzy scoring. (Integrated into FR-011.)
- Q: What Jira retrieval scope and cap apply per squad per run? → A: Current active sprint plus the immediately preceding sprint for the Scrum board (for carryover derivation), and open Kanban issues plus Kanban issues closed within the last 30 days; capped at 500 issues per squad per run; truncation MUST be disclosed as a data limitation. (Integrated into FR-024.)
- Q: How does the system resolve a squad name or alias to a squad configuration? → A: Exact case-insensitive comparison of a whitespace-collapsed request token against the squad's display name and its alias list. Configuration validation MUST reject overlapping aliases across the two squads. (Integrated into FR-010 and FR-012.)
- Q: What are the compact-report limits for Slack output? → A: At most the top 5 delivery risks, 5 blockers, 5 hygiene findings, 5 workload/flow signals, and 5 manager actions per squad report, and at most 10 follow-up drafts per squad report (20 for the daily two-squad briefing). Overflow MUST be disclosed with a single trailing line stating how many additional items exist. (Integrated into FR-014 and FR-022.)
- Q: What language are reports and drafts written in? → A: English (en-US) for the MVP; localization is out of scope. (Already recorded in Assumptions; reinforced in FR-033.)
- Q: What timezone governs schedules and timestamps? → A: Configurable timezone at the top level (per-squad override permitted); defaults to UTC when unset. All Slack timestamps rendered in the manager's configured timezone with an explicit offset (for example `2026-08-06 08:30 UTC+03:00`). (Integrated into FR-008 and FR-014.)
- Q: How is concurrent automation behavior handled? → A: Each run is independent and idempotent. If the daily automation is triggered more than once on the same working day and destination, subsequent runs MUST label the message as a refresh. Concurrent on-demand requests always proceed independently and are never coalesced. (Integrated into FR-018 and Edge Cases.)
- Q: What are the expected secret names for Jira and Slack credentials? → A: Default names are `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `SLACK_BOT_TOKEN`, resolved through a Cursor-supported secret or environment mechanism; names are overridable in configuration and MUST NOT be committed. (Integrated into FR-041.)
- Q: What happens when a squad is configured without any board reference? → A: Configuration validation MUST reject a squad that has neither a Scrum nor a Kanban board reference; at least one board of either type MUST be configured per squad. (Integrated into FR-005 and FR-009.)
- Q: What are the default per-squad thresholds when configuration omits them? → A: Stale-in-progress = 5 business days; no-meaningful-update = 3 business days; maximum simultaneous in-progress items per person = 3. Squad configuration always overrides. (Integrated into FR-007.)
- Q: What retry policy applies to Jira and Slack failures? → A: At most 3 attempts per external call with approximate exponential backoff (1s, 2s, 4s); authentication failures MUST NOT be retried; total wall-clock time per external call chain MUST NOT exceed 60 seconds. (Integrated into FR-039.)
- Q: How does the manager learn that a Slack post failed? → A: The Cursor Automation/Agent execution result MUST surface a non-success status with a machine-readable failure reason for inspection in the run history; the system MUST NOT retry to an alternate Slack destination. (Integrated into FR-038.)
- Q: What qualifies as a "cross-squad priority" in the daily briefing? → A: Issue links crossing the two squads, blockers whose owner is on the other squad, or a shared parent epic containing risk-classified work in both squads; ordered by aggregate impact across both squads. (Integrated into FR-017.)
- Q: How are data limitations disclosed in reports? → A: As a dedicated bullet list at the end of the affected report (or per-squad section within the daily briefing); each bullet names the affected scope (field, board, squad) and a short non-secret reason phrase. (Integrated into FR-025.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - On-Demand Squad Analysis in Slack (Priority: P1)

An engineering manager sends a Slack request naming one of the configured squads (for example, `analyze Storefront squad`, `show blockers for Payments`, `what needs my attention in Storefront?`). The assistant resolves the squad from configuration, retrieves the relevant Jira work for that squad's boards and current sprint, performs an evidence-backed analysis, and posts a concise Slack report back to the manager. The report explains overall squad health, key facts, top delivery risks with supporting evidence and recommended actions, blockers and dependencies, workload and flow signals, Jira hygiene findings, prioritized manager actions, and copy-ready follow-up drafts.

**Why this priority**: This is the manager's primary interactive workflow and the shortest useful end-to-end path. It validates that the assistant can turn Jira data into actionable manager-facing output for a single squad, which is a precondition for the daily briefing and cross-squad workflows.

**Independent Test**: Fully testable by triggering an on-demand Slack request for a single configured squad against a Jira fixture representing typical sprint state (in-progress, blocked, stale, and unestimated items) and verifying that the returned Slack report matches the required section structure, cites Jira issue keys as evidence for each risk, produces at least one recommended manager action, and correctly classifies overall health as On Track, Needs Attention, or At Risk with a stated reason.

**Acceptance Scenarios**:

1. **Given** two squads are configured with valid Jira boards and the manager sends `analyze Storefront squad` in the configured Slack destination, **When** the assistant completes the analysis, **Then** the assistant replies in Slack with a single squad report containing the required sections (header, overall health with rationale, key facts, top risks with evidence and actions, blockers, flow signals, Jira hygiene, prioritized manager actions, and follow-up drafts) using concise Slack Markdown.
2. **Given** the manager types `show blockers for Payments`, **When** the intent maps to the supported "blockers and dependencies" analysis, **Then** the reply focuses on blocked items and cross-squad or external dependencies with the responsible owner and any recorded expected-resolution date, and includes a manager action for every blocker missing an owner or a target date.
3. **Given** the manager sends a request that names an unknown or ambiguous squad (for example, `analyze Growth squad`), **When** the assistant cannot resolve the name or alias, **Then** the assistant replies with a helpful validation message listing the configured squad names and aliases, and does not guess a squad or fabricate an analysis.
4. **Given** a squad has a Kanban board (for production or support work) in addition to a Scrum board, **When** the analysis runs for that squad, **Then** both boards are considered under that squad's identity and unplanned production/support items are surfaced separately from sprint scope.
5. **Given** the manager requests analysis and every high-priority item has a recent update and no blocker, **When** no material delivery risk exists, **Then** the report classifies the squad as On Track, states so explicitly, and does not invent risks, hygiene findings, or follow-up drafts.
6. **Given** three or more work items in the active sprint are missing an estimate but no other delivery concern is present, **When** the report is produced, **Then** those items appear in the Jira hygiene section (not the delivery-risk section) and the overall health is not automatically downgraded to At Risk on hygiene alone.

---

### User Story 2 - Daily Two-Squad Manager Briefing (Priority: P2)

Once each working day, before the team's stand-up, a scheduled automation runs an analysis for both configured squads and posts a private daily briefing to the manager's configured Slack destination. The briefing summarizes the health of each squad in one line, highlights the top cross-squad priorities, lists each squad's most important risks and blockers, suggests stand-up focus items, includes drafted follow-ups requiring manager review, and clearly discloses any data limitation or failed integration. Where prior-run data is unavailable, the briefing describes the current state only and does not claim change since a previous day.

**Why this priority**: This delivers the manager's most-requested outcome (a ready-to-read pre-stand-up view of both squads) without requiring the manager to prompt the assistant. It depends on the same single-squad analysis proven in P1 and adds a scheduled, unattended path.

**Independent Test**: Fully testable by executing the daily automation on demand against fixtures for both squads and verifying that the posted Slack message contains the two-squad report structure (date and scope, one-line per squad, top cross-squad priorities, per-squad risks and blockers, suggested stand-up focus, follow-up drafts, and data limitations), that both squads are covered when both fixtures succeed, and that the message is posted only to the configured manager destination.

**Acceptance Scenarios**:

1. **Given** both squads are configured and Jira responds normally, **When** the daily automation runs on a configured working day, **Then** the manager receives a single private Slack message containing the two-squad daily report with the sections above, and no message is posted to non-configured destinations.
2. **Given** the Jira query for one squad fails while the other succeeds, **When** the daily automation produces the briefing, **Then** the successful squad is reported normally, the failed squad is clearly marked as unavailable with a short reason (without exposing secrets), and the message is still delivered so the manager is not left without any signal.
3. **Given** the automation runs for the first time and no prior-run data is available, **When** the briefing is composed, **Then** the report describes the current state only and does not include any phrasing that implies a "since yesterday" comparison.
4. **Given** the configured schedule specifies working days only, **When** the current day is not a configured working day, **Then** the daily automation does not run and no Slack message is posted.
5. **Given** both squads are healthy with no material risk or blocker, **When** the briefing is produced, **Then** each squad shows an On Track one-liner, the "top risks" and "blockers" sections state explicitly that none are present, and no follow-up drafts are invented.

---

### User Story 3 - Manager-Reviewed Follow-Up Drafts (Priority: P3)

When the analysis identifies missing context, delivery concern, hygiene gap, or unowned dependency that warrants asking a specific person for information, the assistant produces copy-ready follow-up drafts for the manager to review, edit, and send manually. Drafts are grouped for easy review (by recipient and, where useful, by issue), reference the specific Jira issue key and observed evidence, ask for the information the manager actually needs (current progress, blocker, expected completion, missing estimate, alignment of Jira status, or dependency owner and target date), and use respectful, neutral, non-accusatory language. The assistant never sends these drafts to team members automatically.

**Why this priority**: Manager-controlled communication is a core constitutional requirement and the piece that most reduces the manager's manual drafting time. It is enhanced last because it depends on high-quality analysis from P1/P2 to avoid producing tone-deaf or evidence-free messages.

**Independent Test**: Fully testable by feeding an analysis output where at least one item is stale, one is blocked without an owner, one is in progress without an estimate, and one has ambiguous Jira status, and verifying that the drafts are grouped by recipient, cite the correct issue key(s), request the appropriate information type per situation, use neutral respectful language, and are returned as text for the manager (not sent to any Slack user directly).

**Acceptance Scenarios**:

1. **Given** an in-progress issue has had no meaningful update beyond the configured threshold, **When** the assistant generates a follow-up draft for its assignee, **Then** the draft references the issue key, notes the observed silence in neutral terms, and asks for current progress, any blocker, and an expected completion date.
2. **Given** a blocked issue has no recorded dependency owner or expected resolution date, **When** the assistant generates a follow-up draft, **Then** the draft asks who owns the dependency, what an expected resolution date looks like, and whether escalation is needed, and it is addressed to the item's assignee unless a different owner is derivable from evidence.
3. **Given** two draft messages are directed to the same team member, **When** the drafts are surfaced, **Then** they are grouped under one recipient section so the manager can review that person's context together, and each draft still lists its own issue key(s) and reason.
4. **Given** any draft is produced, **When** the assistant returns its output, **Then** no message is transmitted to a team member's DM or to any non-manager Slack destination on its own; only the manager receives the draft output for review.
5. **Given** an issue is only failing a Jira hygiene rule (for example, missing estimate) with no delivery concern, **When** a draft is generated for it, **Then** the wording is framed as a request to update Jira, not as a delivery-risk challenge.

---

### Edge Cases

- **Unknown or ambiguous squad name in Slack**: Return a validation message listing configured squad names and aliases; do not guess a squad.
- **Unknown intent (request text does not match a supported analysis intent)**: Reply with a short list of the supported intents and ask the manager to rephrase; do not fabricate an analysis.
- **Jira authentication fails**: Return a clear authentication error, do not produce an analysis or Slack report claiming success, and never expose the authentication value in the error, logs, or report.
- **Jira request returns partial data (some fields, changelog, or comments are unavailable due to permissions or field configuration)**: Continue where possible, avoid inferring facts that would require the missing data, and disclose the specific limitation in a "Data limitations" section of the report.
- **One squad's Jira query fails during the daily two-squad briefing**: Report the successful squad normally and mark the failed squad as unavailable in the same message.
- **Slack posting fails after analysis completes**: Do not claim delivery succeeded; produce an inspectable execution result so a human can retry or investigate.
- **No prior-run data available (first run, previous run failed, or state not retained)**: Describe current state only; never phrase findings as changes since a previous day.
- **Jira workflow status names differ between the two squads**: Use each squad's configured status mapping; do not assume identical workflows across squads.
- **Squad has both a Scrum and a Kanban board**: Consider both under the same squad and separate sprint scope from unplanned/operational work in the report.
- **Squad has only one board type configured (Scrum or Kanban) but not the other**: Analyze what exists; do not require both to be present.
- **Sprint has already ended or no active sprint exists**: State this explicitly in the report; do not fabricate a sprint context.
- **All items in a squad are healthy**: State that no material risks were found; do not invent risks, hygiene findings, or follow-up drafts.
- **P0- or P1-tier sprint work is unassigned**: Surface as a delivery risk with a recommended manager action.
- **Item is blocked but no blocker structure exists (blocker only mentioned in a comment)**: Surface as a Jira hygiene finding and, if delivery is affected, also as a risk.
- **Item is marked done but has open subtasks, or is open but resolved**: Surface as a Jira hygiene inconsistency, not as a delivery risk on its own.
- **Configuration is missing, invalid, or points to a non-existent Jira board/project**: Refuse to run and return a validation error naming the missing or invalid configuration field; never continue with an unvalidated configuration.
- **Same Slack request is received twice in quick succession**: Treat as two independent requests and reply to each; do not silently drop the second.
- **Daily automation triggered twice on the same working day and destination**: The second run posts an updated briefing labeled as a refresh so the manager can distinguish it from the original run; the first run is not retracted.
- **Squad has no board configured at all (neither Scrum nor Kanban)**: Refuse to run at configuration validation and return an actionable error naming the squad and stating that at least one board reference is required.
- **Data retrieval hits the per-squad cap (500 issues)**: Continue with the retrieved subset and disclose the truncation under Data limitations; do not silently drop items or claim complete coverage.
- **Report list exceeds a per-section cap (for example more than 5 delivery risks or more than 10 follow-up drafts)**: Show the top-ranked items up to the cap and append a single trailing line stating how many additional items exist.

## Requirements *(mandatory)*

### Functional Requirements

**Runtime and delivery boundary**

- **FR-001**: The system MUST execute all analysis and reporting through Cursor capabilities only (Cursor Cloud Agents for analysis, Cursor Automations for scheduled reports, and Cursor-supported Slack triggers for on-demand requests) and MUST NOT introduce a hosted backend, web server, VM, container service, serverless function, queue, database, or independently hosted scheduler.
- **FR-002**: The system MUST integrate with only Jira and Slack as external systems for the MVP; no other external services are permitted.
- **FR-003**: The system MUST NOT persist Jira, Slack, or analysis data in any long-term store outside of what Cursor provides for its execution runs; run-to-run comparisons that would require a persistent database MUST NOT be claimed.
- **FR-004**: The system MUST NOT perform any Jira write operation (no comments, transitions, estimates, assignments, sprint scope changes, or field updates) and MUST NOT send any Slack message to a team member's DM autonomously.

**Squad and board configuration model**

- **FR-005**: The system MUST support exactly two configurable squads in the MVP, each with an independent identity (display name and aliases), configurable Jira project keys, an optional Scrum board reference for planned sprint work, and an optional Kanban board reference for operational/unplanned work. At least one of the two board references (Scrum or Kanban) MUST be configured per squad; a squad with neither board reference MUST be rejected at configuration validation.
- **FR-006**: The system MUST allow each squad to define its own workflow status category mapping (which status names count as not-started, in-progress, blocked, review/handoff, done) and MUST NOT assume identical workflows across the two squads.
- **FR-007**: The system MUST allow each squad to define its own priority mapping, blocker field or dependency-link mapping, sprint schedule or working days, team-member-to-Slack-user mapping (reserved for draft generation), and thresholds for stale-in-progress duration, no-update duration, and maximum recommended simultaneous in-progress items per person. Default thresholds when a squad configuration omits explicit values MUST be: stale-in-progress = 5 business days; no-meaningful-update = 3 business days; maximum simultaneous in-progress items per person = 3. Squad configuration always overrides the defaults.
- **FR-008**: The system MUST support a top-level configuration for the Jira site or base URL reference, the manager's Slack destination for private daily briefings, the daily-automation schedule (including which days count as working days), and the timezone used for schedules and rendered timestamps. Default schedule when unspecified MUST be Monday through Friday at 08:30 in the configured timezone; default timezone when unspecified MUST be UTC. All defaults are overridable via configuration.
- **FR-009**: The system MUST validate configuration on every run and, when a required field is missing or invalid or a referenced board/project does not exist, MUST refuse to run and return an actionable error that names the specific field(s). Configuration validation MUST also reject a squad with no board reference at all (see FR-005) and MUST reject overlapping aliases across the two squads.

**On-demand squad analysis (Workflow 1)**

- **FR-010**: The system MUST accept an on-demand analysis request from Slack that names one configured squad by display name or alias, and MUST resolve that name to the correct squad configuration before running any analysis. Resolution MUST be case-insensitive, MUST collapse surrounding whitespace, and MUST tolerate trailing punctuation; exact-match on the normalized token against the squad's display name or any of its aliases is required (no fuzzy scoring).
- **FR-011**: The system MUST support at least these documented on-demand intents in the first release: (a) full squad analysis, (b) active-sprint analysis, (c) blockers and dependencies, (d) stale or unclear work, (e) missing estimates and Jira hygiene, (f) recommended manager follow-ups. Intent recognition MUST be case-insensitive keyword matching (documented keywords include `analyze`/`full`, `sprint`, `blockers`, `stale`, `hygiene`, `follow-up`) with no fuzzy scoring; when more than one recognized intent keyword is present in a request, the most specific intent MUST win over the general one using this fixed precedence (highest wins): `follow-up` → `hygiene` → `stale` → `blockers` → `sprint` → `full` (for example `blockers` wins over `full`, and `hygiene` wins over `full`).
- **FR-012**: When the squad name is unknown or ambiguous, the system MUST reply with a validation message listing the configured squad names and aliases and MUST NOT guess a squad or fabricate an analysis. Ambiguity here means the normalized token matches more than one configured squad or matches none at all.
- **FR-013**: When the intent is unrecognized, the system MUST reply with the supported intents and MUST NOT infer an analysis type not backed by evidence.
- **FR-014**: Every on-demand analysis MUST return a Slack-friendly Markdown report containing, in order: header (squad, board or sprint, analysis timestamp), overall health with a one-sentence rationale, key facts, top delivery risks (ordered by impact), blockers and dependencies, workload or flow signals, Jira hygiene, recommended manager actions (ordered by priority), draft follow-up messages, and data limitations when applicable. The header timestamp MUST be rendered in ISO 8601 with the manager's configured timezone offset (for example `2026-08-06 08:30 UTC+03:00`). Each list section MUST be capped at the top 5 items (delivery risks, blockers, workload/flow signals, Jira hygiene findings, and recommended manager actions); overflow beyond a cap MUST be disclosed with a single trailing line stating how many additional items exist.
- **FR-015**: The system MUST classify overall squad health as exactly one of `On Track`, `Needs Attention`, or `At Risk`, MUST include the reasons for that classification, and MUST NOT emit a numeric confidence percentage unless a future specification defines a validated method. Classification boundaries MUST be: `On Track` when no delivery risks are present; `Needs Attention` when 1 or 2 delivery risks are present AND no unowned P0/P1 blocker exists AND no P0- or P1-tier sprint work remains unassigned after 50% of the sprint has elapsed; `At Risk` when three or more delivery risks are present, OR any unowned P0/P1 blocker exists, OR any P0- or P1-tier sprint work remains unassigned after 50% of the sprint has elapsed. "P0/P1 tier" means issues mapped to internal priority tiers `P0` or `P1` via the squad's `priorityMapping` (see FR-007). Jira hygiene findings MUST NOT influence the classification (see FR-028).

**Daily manager briefing (Workflow 2)**

- **FR-016**: The system MUST provide a daily manager briefing that runs once per configured working day, before stand-up, executed by a Cursor Automation and delivered as a private Slack message to the configured manager destination. When the schedule is not explicitly configured, the automation MUST default to Monday through Friday at 08:30 in the configured timezone (see FR-008).
- **FR-017**: The daily briefing MUST include, in order: date and reporting scope, a one-line status for each of the two squads, top cross-squad priorities, per-squad risks and blockers, suggested stand-up focus items, draft follow-ups requiring manager review, and any data limitations or failed integrations. "Cross-squad priorities" MUST be defined as items or dependencies visible in both squads simultaneously — specifically issue links whose two ends belong to the two different squads, blockers whose owning assignee is on the other squad, or a shared parent epic containing risk-classified work in both squads — and MUST be ordered by aggregate impact across both squads.
- **FR-018**: When the daily briefing has no prior-run data available, the system MUST describe the current state only and MUST NOT phrase any finding as a change "since yesterday" or otherwise imply a prior-day comparison. If the daily automation is triggered more than once on the same working day and destination (for example, a manual refresh), each subsequent run for the same date MUST label the message as a refresh so the manager can distinguish it from the original run; on-demand analysis requests are always independent and MUST NEVER be coalesced or deduplicated.
- **FR-019**: When one squad's Jira query fails during the daily briefing, the system MUST still produce the message, MUST report the successful squad normally, and MUST clearly mark the failed squad as unavailable with a short reason (without exposing secrets).

**Follow-up drafts (Workflow 3)**

- **FR-020**: The system MUST generate copy-ready follow-up drafts as part of the report when the analysis identifies missing context, delivery concern, hygiene gap, or unowned dependency that warrants asking a specific person for information.
- **FR-021**: Each draft MUST reference the specific Jira issue key(s), describe the observation in neutral terms, and request the information the manager actually needs (progress, blocker, expected completion, estimate, Jira status alignment, or dependency owner and target date), using respectful and non-accusatory language.
- **FR-022**: Drafts MUST be grouped for the manager's review by recipient, and, where useful, by issue within that recipient. At most 10 drafts MUST be shown per squad report and at most 20 across the daily two-squad briefing; when more drafts are available, a trailing line MUST disclose how many additional drafts exist so the manager can request them explicitly.
- **FR-023**: The system MUST NOT send drafts directly to team members and MUST return them only to the manager for review.

**Jira data and analysis behavior**

- **FR-024**: The system MUST retrieve, for each configured squad, at minimum the following Jira information when permissions allow: issue key, summary, project, board, sprint, issue type, priority, status, assignee, story-point or time estimate, created and updated timestamps, status-transition history or age in current status, sprint start/end dates, labels, components, linked issues, parent/subtask relationships, blocker flag or configured blocker field, dependency issue links, latest meaningful comments, resolution and resolution date, indicators of items added after sprint start (when derivable), and previous sprint participation or carryover (when derivable without a persistent database). Retrieval scope per squad per run MUST be: for a Scrum board — all issues in the current active sprint plus the immediately preceding sprint (used only for carryover derivation); for a Kanban board — all open issues plus issues closed within the last 30 days. Retrieval per squad per run MUST be capped at 500 issues; when the cap is reached, the report MUST disclose the truncation under Data limitations.
- **FR-025**: The system MUST tolerate Jira instances where some fields or history are unavailable and MUST continue with a partial analysis, disclosing the specific limitation in the report. Data-limitation disclosures MUST appear as a dedicated bullet list at the end of the affected report (or per-squad section within the daily briefing); each bullet MUST name the affected scope (field, board, squad) and a short non-secret reason phrase, and MUST NEVER include raw error payloads, credentials, or personal Slack conversation content.
- **FR-026**: The system MUST identify at least the following delivery risks (each with supporting Jira evidence): item in progress beyond the configured stale threshold; item with no meaningful recent update beyond the configured no-update threshold; blocked item lacking a clear dependency owner or expected resolution; P0- or P1-tier work unassigned; important sprint work not started while little sprint time remains; story depending on work outside the squad; parent and subtasks in inconsistent states; work repeatedly moving between statuses or reopened; and significant unplanned work threatening sprint commitments.
- **FR-027**: The system MUST identify at least the following Jira hygiene findings (kept separate from delivery risks): missing estimate; missing assignee; missing or unclear acceptance criteria when detectable; status appearing inconsistent with subtasks or resolution; blocker mentioned but not represented structurally; completed work remaining open; and stale comments or missing progress context.
- **FR-028**: A Jira hygiene finding alone MUST NOT cause overall squad health to be classified as `At Risk`; hygiene issues are reported separately from delivery risks.
- **FR-029**: The system MUST surface workload and flow signals in neutral, non-judgmental language, at minimum: more simultaneous in-progress items on one person than the configured threshold; concentration of critical work on a single team member; review/handoff bottleneck visible from Jira status; unowned queue of urgent work; and blocked work concentrated around a single external dependency.
- **FR-030**: Every reported risk MUST include supporting Jira evidence (such as issue key, status, age, estimate, sprint timing, blocker, dependency, or recent update) and a recommended manager action, and MUST NOT be reported without such evidence.
- **FR-031**: Sprint health analysis MUST cover time elapsed vs. time remaining, completed/in-progress/blocked/not-started counts, unplanned items added after sprint start (when derivable), items with missing estimates, large unfinished stories, unresolved dependencies, and carryover indicators when Jira history supports them.
- **FR-032**: The system MUST NOT use completed story points as a measure of an individual's performance, MUST NOT rank engineers or create productivity scores, and MUST NOT characterize people as slow, weak, unproductive, or underperforming.

**Reporting output shape**

- **FR-033**: Slack output MUST use concise Slack-friendly Markdown; when no concerns exist in a section (risks, blockers, hygiene, drafts), the system MUST state so explicitly rather than invent findings or omit the section.
- **FR-034**: Reports MUST be ordered by importance (risks and actions before hygiene; risks ordered by impact; actions ordered by priority) so the manager can act from the top of the message.
- **FR-035**: Every reported risk in the Slack report MUST include the manager action recommended for that risk, next to the evidence.
- **FR-036**: The system MUST NOT display raw secrets or authentication values in reports, logs, or error output.

**Failure handling and reliability**

- **FR-037**: When Jira authentication fails, the system MUST NOT produce an analysis and MUST return a clear authentication error without exposing the credential value.
- **FR-038**: When Slack posting fails after the analysis is complete, the system MUST NOT claim delivery succeeded and MUST produce an execution result suitable for inspection so a human can retry or investigate. The failure signal MUST be surfaced through the Cursor Automation/Cloud Agent execution result (non-success status with a machine-readable failure reason visible in the Cursor run history); the system MUST NOT autonomously retry the post to any alternate Slack destination.
- **FR-039**: For likely temporary failures against Jira or Slack, the system MAY use bounded retries; unbounded retries and uncontrolled loops MUST NOT be used. Bounded retries MUST be at most 3 attempts per external call with approximately exponential backoff (roughly 1s, 2s, 4s), MUST NOT be applied to authentication failures, and the total wall-clock time across retries for a single external call chain MUST NOT exceed 60 seconds.
- **FR-040**: The system MUST NOT treat missing data as evidence that everything is healthy; a lack of signal MUST be disclosed as a limitation or as a needed clarification rather than presumed to be On Track.

**Security and privacy**

- **FR-041**: The system MUST use least-privilege, preferably read-only Jira credentials configured through supported Cursor secret or environment mechanisms; secrets MUST NOT be committed to the repository. Default expected environment variable names for secrets MUST be `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `SLACK_BOT_TOKEN`; these names MAY be overridden per deployment via configuration but MUST always be resolved through the Cursor-supported secret or environment mechanism. Secret values MUST NOT appear in reports, logs, or error output.
- **FR-042**: The system MUST limit Jira data retrieval to configured projects and boards for each squad, and MUST NOT read Jira content outside that scope.
- **FR-043**: The system MUST send Slack output only to configured destinations (the manager's Slack destination for daily briefings and the originating Slack thread/channel for on-demand requests).
- **FR-044**: The system MUST NOT collect, store, or forward Slack conversations that are unrelated to the on-demand request that triggered it.
- **FR-045**: Reports MUST avoid unnecessary personal data and MUST NOT create employee rankings or performance profiles of any kind.

**Testability of analysis rules**

- **FR-046**: Deterministic analysis rules (stale work, status aging, missing estimates, missing assignees, blockers, sprint timing, scope additions, carryover signals, work-in-progress thresholds) MUST be independently exercisable against anonymized fixtures without live Jira or Slack access.
- **FR-047**: The output of AI contextual analysis (as opposed to deterministic rules) MUST be validated against a structured shape before it is rendered to Slack, so that malformed or evidence-free AI output does not reach the manager.

**Documentation and operability**

- **FR-048**: The repository MUST contain the specifications, configuration schema, prompts, report templates, deterministic rule descriptions, anonymized Jira fixtures, and operating documentation needed to run and maintain the MVP, so that no critical behavior depends on undocumented Cursor conversation context.

### Key Entities *(include if feature involves data)*

- **Squad**: The unit of analysis. Has a display name, one or more aliases used in Slack requests, a Jira project key set, an optional Scrum board reference, an optional Kanban board reference, a workflow status category mapping, a priority mapping, a blocker/dependency mapping, a sprint schedule and working-days definition, thresholds (stale-in-progress duration, no-update duration, maximum recommended simultaneous in-progress items per person), and a team-member-to-Slack-user mapping for draft generation.
- **Board**: A Jira board attached to a squad. Either Scrum (used for planned sprint work) or Kanban (used for operational/unplanned work). A squad may have one or both.
- **Sprint**: A time-boxed unit belonging to a Scrum board, with start and end dates, a set of committed items, and possibly added-after-start items. Only present for squads with a Scrum board and an active sprint.
- **Work Item**: A Jira issue analyzed by the system. Has an issue key, summary, project, board, optional sprint, type, priority, current status, assignee, estimate, created/updated timestamps, age in current status (when derivable), labels, components, linked issues, parent/subtask relationships, blocker signal, latest meaningful comments, and resolution status.
- **Delivery Risk**: A finding that a work item, dependency, or sprint outcome is materially at risk of missing an expected delivery. Includes a category (e.g. stale, no-update, unowned blocker, unassigned critical, late-start, cross-squad dependency, subtask inconsistency, thrash/reopen, unplanned scope), the supporting Jira evidence (issue keys, status, age, estimate, sprint timing, dependency, or recent update), an impact description, and a recommended manager action.
- **Blocker / Dependency**: A specific structural or textual signal that a work item is blocked or depends on other work, together with (when known) the dependency owner and expected resolution date.
- **Jira Hygiene Finding**: A data-quality issue about a work item (missing estimate, missing assignee, unclear acceptance criteria when detectable, status inconsistent with subtasks or resolution, unstructured blocker mention, completed work still open, stale comments) reported separately from delivery risks.
- **Workload / Flow Signal**: A neutral observation about squad throughput or capacity (WIP overload on one person, concentration of critical work, review/handoff bottleneck, unowned urgent queue, external-dependency concentration), phrased without judging individuals.
- **Squad Health Classification**: One of `On Track`, `Needs Attention`, `At Risk`, with the reasons that justify the classification. Does not include a numeric confidence percentage.
- **Follow-Up Draft**: A copy-ready message the manager can review, edit, and send manually. References specific issue key(s), states the observation neutrally, requests specific information (progress, blocker, expected completion, estimate, Jira status alignment, or dependency owner/date), and is grouped by recipient for review.
- **Squad Report**: The Slack output for one squad, with the required section order (header, health with rationale, key facts, top risks, blockers and dependencies, workload/flow signals, Jira hygiene, manager actions, follow-up drafts, data limitations when applicable).
- **Daily Two-Squad Briefing**: The Slack output covering both squads, with date and scope, one-line status per squad, cross-squad priorities, per-squad risks and blockers, stand-up focus, follow-up drafts, and data limitations when applicable.
- **Configuration**: The repository-managed configuration set (see FR-005 through FR-008), validated at run time with actionable errors for missing or invalid fields.
- **Data Limitation Notice**: A disclosure in the report about a field, history, or squad that could not be fully retrieved, so the manager can weigh the analysis accordingly.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any configured squad name or alias, the manager receives a fully structured Slack squad report (all required sections present, health classified, at least one risk with evidence and action when risks exist, or an explicit "no material concerns" statement when none exist) in response to an on-demand Slack request in at least 95% of successful runs against representative fixtures.
- **SC-002**: 100% of reported delivery risks in generated reports include at least one supporting Jira evidence element (issue key, status, age, estimate, sprint timing, blocker/dependency, or recent update) and a recommended manager action, verified across the deterministic-rule test set and AI-output validation.
- **SC-003**: An on-demand Slack request that names an unknown or ambiguous squad produces a validation message listing configured squad names and aliases in 100% of cases and produces zero fabricated analyses.
- **SC-004**: The daily two-squad briefing, when both Jira queries succeed, is delivered to the configured manager Slack destination on every configured working day it is scheduled to run, with both squads present and the required section structure, in at least 95% of scheduled runs against representative fixtures.
- **SC-005**: When one squad's Jira query fails during a daily briefing, the briefing is still delivered with the successful squad reported normally and the failed squad clearly marked as unavailable in 100% of such runs.
- **SC-006**: When Jira authentication fails, no analysis output and no misleading "delivered" status is produced in 100% of such runs; a clear authentication error is returned without exposing the credential value.
- **SC-007**: A Jira hygiene issue (for example, a missing estimate) does not by itself cause the overall squad health to be classified `At Risk` in 100% of such cases; hygiene findings appear separately from delivery risks.
- **SC-008**: In 100% of generated reports, no individual is characterized as underperforming, ranked, or scored, and no ticket count or story-point count is presented as a direct measure of an individual's performance.
- **SC-009**: 100% of follow-up drafts produced in the MVP are returned only to the manager for review; no MVP path sends drafts directly to team members.
- **SC-010**: Configuration validation catches 100% of the following at run time before any Jira call is made: missing required fields, unknown or invalid board or project references, and status-mapping entries that do not resolve; each error names the specific field(s).
- **SC-011**: The manager reports a reduction of at least 30 minutes of manual Jira review time per stand-up day (measured against the manager's self-reported baseline) after adopting the daily briefing and on-demand analysis, based on a self-report over two consecutive sprints.
- **SC-012**: The manager can change squad aliases, per-squad thresholds, workflow status mappings, priority mappings, board references, or the Slack destination by editing configuration only (no code change), verified by modifying the two-squad fixture configuration (for example adding a new alias, changing a stale threshold, or updating a status mapping) and confirming the squad remains resolvable, analyzable, and reportable end-to-end with no changes outside configuration files. Adding a third squad remains out of scope for the MVP (see FR-005).
- **SC-013**: 100% of MVP delivery paths (on-demand single-squad, daily two-squad briefing, follow-up drafts) run entirely on Cursor capabilities (Cursor Cloud Agent, Cursor Automation, Cursor-supported Slack trigger) with no hosted backend, VM, container service, serverless function, queue, database, or independently hosted scheduler introduced.
- **SC-014**: 100% of the deterministic analysis rules (stale work, status aging, missing estimates, missing assignees, blockers, sprint timing, scope additions, carryover signals, work-in-progress thresholds) are exercisable against anonymized fixtures without live Jira or Slack access.

## Assumptions

- **Cursor-only runtime is available for all MVP paths**: Cursor Cloud Agents can execute the analysis, Cursor Automations can run daily reports, and Cursor supports a Slack trigger mechanism (or an equivalent Cursor-supported integration path) sufficient to receive the on-demand requests described in User Story 1 and to post replies. The specific trigger mechanism is an implementation decision for the plan phase and is not fixed here.
- **Two squads with mixed board types is the MVP shape**: The MVP is scoped to exactly two configurable squads, each of which may have a Scrum board, a Kanban board, both, or (rarely) only one, and workflows are not assumed identical.
- **Read-only Jira access is sufficient**: The MVP requires only read access to Jira for the configured projects and boards. Any Jira write operation is out of scope and constitutes a constitutional exception.
- **Manager Slack destination is a private DM or a private channel the manager controls**: The daily briefing is delivered to a Slack destination configured explicitly by the manager, and the assistant does not choose the destination.
- **Working-day and stand-up timing are configuration**: The definition of which days are working days for the daily briefing and the pre-stand-up delivery time are supplied via configuration, not inferred. When configuration omits these values, the automation defaults to Monday through Friday at 08:30 in the configured timezone (default UTC); see FR-008 and FR-016.
- **Default per-squad thresholds exist for stale, no-update, and WIP limits**: When a squad configuration does not set an explicit value, the assistant uses stale-in-progress = 5 business days, no-meaningful-update = 3 business days, and maximum simultaneous in-progress items per person = 3; see FR-007.
- **Timezone is explicit configuration with a UTC fallback**: All schedules and rendered timestamps use the timezone configured at the top level (per-squad overrides permitted); if unset, UTC is used. Timestamps are rendered in ISO 8601 with the offset; see FR-008 and FR-014.
- **Secret names follow a documented default set**: Default expected environment variable names are `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `SLACK_BOT_TOKEN`, overridable via configuration; see FR-041.
- **Every squad has at least one board**: A squad must have at least one Scrum or Kanban board configured; configuration validation rejects a squad with neither; see FR-005 and FR-009.
- **Reports are compact by design**: Each report caps list sections at the top 5 items (delivery risks, blockers, workload/flow signals, hygiene findings, manager actions) and at most 10 follow-up drafts per squad report (20 for the daily two-squad briefing); overflow is disclosed via a trailing count line; see FR-014 and FR-022.
- **Retrieval is scoped and capped**: Retrieval per squad per run is scoped to the current active sprint plus the previous sprint for Scrum boards, and open Kanban issues plus Kanban issues closed within the last 30 days, capped at 500 issues per squad per run; see FR-024.
- **No prior-run persistence across Cursor runs**: The MVP does not maintain its own historical database. Comparisons that would require durable state ("since yesterday") are not made; only Jira-derived history (changelog, sprint history) is used where available.
- **Follow-up drafts are text-only for the manager**: Drafts are returned to the manager for review; the assistant does not know or need to know how the manager will actually send them (Slack DM, in-person, in stand-up).
- **AI-generated contextual analysis is auxiliary to deterministic rules**: Deterministic rules are the primary source of risks and hygiene findings; AI is used for contextual framing and drafting, and its output is validated against a structured shape before rendering.
- **Anonymized fixtures represent realistic squads**: Test fixtures are anonymized Jira data that adequately represent typical states (in-progress, blocked, stale, unestimated, unassigned, cross-squad dependencies, subtask inconsistencies) so behavior can be exercised without live Jira access.
- **Slack Markdown compatibility**: Reports use Slack-friendly Markdown (bold, italics, bullets, inline code for issue keys) rather than any Slack-specific block-kit or interactive-message feature, unless the plan phase introduces such a feature.
- **Language of reports and drafts is English**: Report and draft text is composed in English by default; localizing to another language is an out-of-scope decision for the MVP.
- **Cursor-supported secret mechanism is available**: Jira and Slack credentials are supplied via a Cursor-supported secret or environment mechanism and are never committed to the repository; the specific mechanism is chosen in the plan phase.

## Out of Scope

The following capabilities are explicitly out of scope for this feature; introducing any of them would constitute either a separate specification or a constitutional exception.

- Hosting a backend, web server, VM, container service, serverless function, queue, database, or independently hosted scheduler.
- A standalone web user interface (dashboard, portal, or admin console).
- A long-term analytics warehouse or history database beyond what Cursor provides for its execution runs.
- Autonomous Slack DMs or channel messages to team members without manager review.
- Any Jira write operation (comments, transitions, estimates, assignments, sprint scope changes, field updates).
- Individual performance scoring, engineer ranking, productivity indices, or disciplinary signals of any kind.
- Azure DevOps analysis, pull-request analysis, GitHub integration, and calendar integration.
- Retrospective generation, one-to-one meeting preparation, and organization-wide reporting.
- Machine-learning-based completion or delivery-date prediction.
- Complex multi-day conversational workflows or long-running stateful agent conversations.
- More than two squads in the MVP configuration (additional squads are a future extension).
