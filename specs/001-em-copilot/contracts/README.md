# EM Copilot Contracts

JSON Schema contracts for configuration, pipeline interchange, and execution results.

| File | Purpose |
|------|---------|
| [config-schema.json](./config-schema.json) | `config/em-copilot.yml` validation (FR-005–FR-009) |
| [normalized-squad-snapshot.schema.json](./normalized-squad-snapshot.schema.json) | Post-Jira normalization interchange |
| [deterministic-findings.schema.json](./deterministic-findings.schema.json) | Rule engine output per squad |
| [contextual-analysis.schema.json](./contextual-analysis.schema.json) | AI output validated before render (FR-047) |
| [slack-request.schema.json](./slack-request.schema.json) | Parsed on-demand Slack request (FR-010, FR-011) |
| [daily-briefing.schema.json](./daily-briefing.schema.json) | Daily two-squad briefing aggregate (FR-017, FR-018) |
| [run-result.schema.json](./run-result.schema.json) | Cursor run history result (FR-038) |

Implementation MUST mirror these schemas in Zod types under `src/contracts/` (Phase: implement).
