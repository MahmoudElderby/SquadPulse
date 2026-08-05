# Engineering Manager Copilot Constitution

## Core Principles

### I. Cursor-Only Runtime

The product MUST run through Cursor Cloud Agents, Cursor Automations, and supported Cursor triggers. Scheduled work MUST use Cursor Automations, and on-demand Slack work MUST use the simplest Cursor-supported trigger mechanism. The project MUST NOT introduce a hosted backend, web server, VM, Kubernetes workload, container service, serverless API, queue, database, or independently hosted scheduler. Repository scripts MAY support agent execution but MUST remain lightweight and MUST NOT become a hidden persistent service.

**Rationale:** The product exists to remove operational work from the engineering manager; it must not create a new platform that requires operation.

### II. Narrow, Incremental Scope

The MVP MUST integrate only Jira and Slack and MUST support two configurable squads. Initial capabilities MUST be limited to on-demand analysis, daily manager briefings, Jira hygiene detection, delivery-risk identification, and manager-reviewed follow-up drafts. Azure DevOps, PR analysis, autonomous follow-ups, Jira writes, long-term analytics, and complex stateful workflows require separate future specifications.

**Rationale:** The smallest useful workflow should be validated before extending the product or its architecture.

### III. Manager Assistance, Not Employee Surveillance

The assistant MUST analyze work, risks, dependencies, workload signals, process health, and missing context. It MUST NOT rank engineers, create productivity scores, infer performance ratings, or characterize people as slow, weak, unproductive, or underperforming. Ticket counts, story points, commits, and activity frequency MUST NOT be treated as direct measures of individual performance. People-related findings MUST use neutral, evidence-based language and recommend a manager conversation when context is missing.

**Rationale:** Jira reflects work state, not the complete contribution or performance of a person.

### IV. Evidence Before Conclusions

Every risk MUST identify the Jira evidence supporting it, including applicable issue keys, statuses, age, estimates, sprint timing, blockers, dependencies, or recent updates. The assistant MUST distinguish observed facts from contextual inference. Missing evidence MUST result in an explicit limitation or clarifying question, never a fabricated explanation. Forecasts MUST avoid false precision.

**Rationale:** Engineering-management decisions require traceable evidence and honest uncertainty.

### V. Human-Controlled Communication

The MVP MUST draft follow-up messages for manager review and MUST NOT automatically send sensitive messages to team members. Messages related to delay, workload, ownership, quality, conduct, or performance always require human control. Suggested communication MUST be respectful, concise, issue-specific, and focused on collecting context or removing blockers. The assistant MUST NOT impersonate the manager through unapproved communication.

**Rationale:** Automated communication can damage trust when nuance, context, or authority is missing.

### VI. Action-Oriented, Consistent Reporting

Reports MUST prioritize decisions and recommended actions over raw Jira statistics. Reports MUST consistently present overall health, key evidence, delivery risks, blockers, flow signals, Jira hygiene, prioritized manager actions, and draft follow-ups. Slack output MUST be concise, ordered by importance, and free of repetitive low-value observations. The assistant MUST NOT invent concerns when the available data indicates none.

**Rationale:** The product is useful only when it reduces the manager's cognitive and coordination workload.

### VII. Configuration Over Hardcoding

Squad names, aliases, projects, board IDs, workflow mappings, thresholds, schedules, Slack destinations, and team mappings MUST be repository-managed configuration. Status names and Jira fields MUST NOT be assumed to be identical across squads. Configuration MUST be validated with actionable errors. Secrets MUST use Cursor-supported secret or environment mechanisms and MUST never be committed.

**Rationale:** Jira and team operating models vary, while the core analysis behavior should remain reusable and auditable.

### VIII. Safe, Read-First Integrations

The MVP MUST use least-privilege, preferably read-only Jira access. It MUST NOT modify Jira issues, comments, transitions, estimates, assignments, or sprint scope. The assistant MUST NOT perform external writes based only on AI inference. Data retrieval MUST be limited to configured boards and projects. Logs and reports MUST not expose credentials or unnecessary personal data.

**Rationale:** Read-only integration minimizes security, trust, and operational risk while validating the product's value.

### IX. Lightweight Reliability and Honest Failure

Automations MUST handle Jira and Slack failures explicitly. A failed or partial data fetch MUST be reported and MUST NOT produce a fabricated healthy status. Temporary failures SHOULD use bounded retries without uncontrolled loops. Scheduled actions SHOULD be idempotent where Cursor capabilities permit. The implementation MUST favor clear, inspectable workflows over unnecessary abstractions.

**Rationale:** Lightweight architecture still requires dependable behavior and transparent limitations.

### X. Testable Rules and Structured AI Output

Deterministic analysis rules MUST be independently testable. Tests MUST cover stale work, status aging, missing estimates, missing assignees, blockers, sprint timing, scope additions, carryover signals, and work-in-progress thresholds. AI contextual analysis MUST operate on normalized data and produce a structured result that is validated before Slack rendering. Fixtures MUST be anonymized, and core behavior MUST be testable without live Jira or Slack access.

**Rationale:** Predictable rules and validated outputs reduce hallucination and make agent behavior maintainable.

### XI. Repository as Source of Truth

Prompts, report templates, rules, configuration schemas, specifications, runbooks, and operating assumptions MUST live in version control. Critical behavior MUST NOT depend on undocumented Cursor conversation context. Artifacts SHOULD remain portable enough to migrate to another agent platform later without rewriting product requirements.

**Rationale:** Versioned artifacts make AI behavior reviewable, reproducible, and portable.

### XII. Incremental End-to-End Delivery

Development MUST proceed through independently useful vertical slices: one-squad on-demand analysis, two-squad analysis, daily briefing, and follow-up drafts. The project MUST NOT introduce databases, workflow engines, queues, or persistent conversation stores in anticipation of hypothetical scale. Every slice MUST include documentation, test fixtures, failure handling, and a runnable usage path.

**Rationale:** Working end-to-end value is preferred over speculative architecture.

## Security and Privacy Requirements

- Credentials MUST be stored only through supported secret mechanisms.
- Authentication values MUST be redacted from logs and errors.
- Jira access MUST be scoped to configured projects and boards.
- Slack output MUST be sent only to configured destinations.
- The system MUST NOT collect unrelated private Slack conversations.
- Generated reports MUST avoid unnecessary personal data.
- Individual performance profiles, rankings, and automated disciplinary signals are prohibited.

## Quality Gates

A specification or implementation is acceptable only when:

1. It complies with the Cursor-only runtime boundary.
2. Its user outcomes and acceptance scenarios are explicit.
3. Every risk output is traceable to evidence.
4. Deterministic rules have automated tests.
5. Live integrations can be replaced with fixtures for testing.
6. Failure and partial-data behavior is defined.
7. Sensitive communication remains human-controlled.
8. Configuration and secrets are not hardcoded.
9. Out-of-scope capabilities have not been introduced indirectly.
10. User-facing Slack output is concise and actionable.

## Governance

This constitution is the highest-priority project guidance and governs all specifications, plans, task lists, implementations, and reviews.

Every implementation plan MUST include a Constitution Check that confirms compliance with each relevant principle. Any proposal introducing hosted infrastructure, persistent services, individual performance scoring, autonomous sensitive communication, or Jira write access is a constitutional exception and requires an explicit amendment before implementation.

Amendments MUST document the reason, affected principles, compatibility impact, and required migration. Constitution versions follow semantic versioning:

- **MAJOR:** removes or materially weakens a principle.
- **MINOR:** adds a principle or materially expands governance.
- **PATCH:** clarifies wording without changing intent.

**Version:** 1.0.0  
**Ratified:** 2026-08-06  
**Last Amended:** 2026-08-06
