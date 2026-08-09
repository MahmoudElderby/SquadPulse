# Engineering Communication Assistant Contracts

JSON Schema contracts for the follow-up workflow, analysis input bridge, and execution results.

| File | Purpose |
|------|---------|
| [squad-analysis-artifact.schema.json](./squad-analysis-artifact.schema.json) | 001→002 analysis input bridge (FR-008) |
| [follow-up-proposal.schema.json](./follow-up-proposal.schema.json) | Single proposal + AI draft validation (FR-014, FR-042) |
| [follow-up-cycle.schema.json](./follow-up-cycle.schema.json) | In-memory cycle state interchange |
| [follow-up-slack-request.schema.json](./follow-up-slack-request.schema.json) | Parsed manager Slack commands (FR-006, FR-019) |
| [reply-summary.schema.json](./reply-summary.schema.json) | Manager reply summary output (FR-028) |
| [follow-up-run-result.schema.json](./follow-up-run-result.schema.json) | Cursor run history for follow-up workflow |

Cross-references 001 contracts (not duplicated here):

- [../001-em-copilot/contracts/deterministic-findings.schema.json](../001-em-copilot/contracts/deterministic-findings.schema.json)
- [../001-em-copilot/contracts/contextual-analysis.schema.json](../001-em-copilot/contracts/contextual-analysis.schema.json)
- [../001-em-copilot/contracts/normalized-squad-snapshot.schema.json](../001-em-copilot/contracts/normalized-squad-snapshot.schema.json)

Implementation MUST mirror these schemas in Zod types under `src/contracts/` (implement phase).
