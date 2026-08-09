# Data Model: Engineering Communication Assistant (MVP)

**Feature**: `002-engineering-communication-assistant`  
**Date**: 2026-08-09

This document defines entities for the follow-up communication workflow. Cycle state exists in memory for the duration of a single `followups:cycle` script execution. The SquadAnalysisArtifact is a gitignored JSON file bridging feature 001 and 002 — not a database.

## Entity Relationship Overview

```text
SquadAnalysisArtifact (001 output, gitignored file)
  ├── analyzedAt, squadId, workflow
  ├── snapshot (subset)
  ├── deterministicFindings
  ├── contextualAnalysis (optional)
  └── limitations[]

FollowUpCycle (in-memory, one poll-loop execution)
  ├── squadId, managerThreadTs, analysisConsumed
  ├── proposals[]: FollowUpProposal
  ├── deliveries[]: ApprovedMessageDelivery
  ├── inCycleContext: InCycleContext
  ├── dataLimitations[]: DataLimitationNotice
  └── status: active | closing | closed

FollowUpProposal
  ├── evidence → EngPilot finding refs
  └── status state machine

EngineerReply (per delivery)
  └── feeds CycleReplySummary

ManagerAction → mutates FollowUpProposal status
```

---

## Input: SquadAnalysisArtifact

Written by feature 001 on successful analysis; read by 002 at cycle start. Schema: [contracts/squad-analysis-artifact.schema.json](./contracts/squad-analysis-artifact.schema.json).

| Field | Type | Required | Validation / Notes |
|-------|------|----------|-------------------|
| `squadId` | string | yes | Must match configured squad |
| `squadDisplayName` | string | yes | Shown in preview header |
| `analyzedAt` | ISO 8601 datetime | yes | Used for FR-009 staleness check |
| `workflow` | `on-demand` \| `daily` | yes | Provenance only |
| `snapshot` | object | yes | Subset: `sprints[]`, `workItems[]` (assignee, priority, status, keys) |
| `deterministicFindings` | DeterministicFindings | yes | Same shape as 001 contract |
| `contextualAnalysis` | ContextualAnalysis | no | Optional AI drafts from 001 |
| `limitations` | DataLimitationNotice[] | no | Passed through to preview (FR-040) |

**Validation rules**:
- Reject artifact when `squadId` does not match requested squad.
- Missing file → FR-037 (no proposals).
- `analyzedAt` + `analysisFreshnessHours` → informational `possibly stale` flag only.

---

## FollowUpCycle

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `cycleId` | string (UUID) | yes | Generated at start |
| `squadId` | string | yes | One squad per invocation (FR Assumptions) |
| `managerThreadTs` | string | yes | Slack thread anchor for poll loop |
| `startedAt` | ISO datetime | yes | |
| `analysisConsumed` | `{ artifactPath, analyzedAt, possiblyStale }` | yes | FR-009 disclosure |
| `proposals` | FollowUpProposal[] | yes | Max `maxProposalsPerCycle` (default 10) |
| `overflowCount` | integer | no | When candidates > cap (FR-019) |
| `deliveries` | ApprovedMessageDelivery[] | no | Populated after approvals |
| `inCycleContext` | InCycleContext | yes | Empty at start (FR-030) |
| `dataLimitations` | DataLimitationNotice[] | no | FR-040 bullet list |
| `status` | enum | yes | `active` → `closing` → `closed` |

**State transitions**:
- `active` — poll loop running; accepts manager commands.
- `closing` — `done` received or all proposals terminal; flushing final summary.
- `closed` — script exiting; in-cycle context discarded (FR-032).

**Cycle boundary** (FR-043): Starts on valid `followups <squad>` parse; ends when poll loop exits (manager `done`, idle timeout, or terminal state).

---

## FollowUpProposal

| Field | Type | Required | Validation / Notes |
|-------|------|----------|-------------------|
| `index` | integer ≥ 1 | yes | Numbered from 1 in preview (FR-019) |
| `issueKey` | string | yes | Single primary key per proposal |
| `engineerDisplayName` | string | yes | Jira assignee or dependency owner |
| `slackUserId` | string | no | From `teamMemberSlackMap`; missing → skip on approve |
| `reasonType` | FollowUpReasonType | yes | FR-011 enum |
| `draftMessage` | string | yes | AI-generated; validated before preview |
| `confidence` | `Low` \| `Medium` \| `High` | yes | FR-017; no numeric % |
| `urgency` | `Low` \| `Medium` \| `High` | yes | FR-018; manager-only triage |
| `evidence` | EvidenceRef[] | yes | ≥1 item; FR-012 |
| `status` | ProposalStatus | yes | See state machine below |
| `editedMessage` | string | no | Last manager edit wins (FR-021) |

### FollowUpReasonType (FR-011)

`progress-update` | `blocker-clarification` | `estimate-reminder` | `jira-status-reminder` | `dependency-follow-up` | `sprint-risk-clarification`

### EvidenceRef

| Field | Type | Notes |
|-------|------|-------|
| `source` | `deliveryRisk` \| `blocker` \| `hygieneFinding` \| `contextualDraft` | Traceability |
| `issueKey` | string | |
| `summary` | string | Neutral evidence bullet |

### ProposalStatus state machine

```text
pending ──approve──► approved ──send OK──► sent
   │                    │
   │                    └──send fail──► failed
   │
   ├──edit (no approve yet)──► pending (editedMessage set)
   ├──ignore──► ignored
   └──approve all──► approved (same as approve)

approved + editedMessage ──send──► sent (uses editedMessage text)
missing slackUserId on approve ──► skipped
```

Terminal statuses: `sent`, `failed`, `skipped`, `ignored`.

---

## ManagerAction

| Field | Type | Notes |
|-------|------|-------|
| `actionType` | `approve` \| `edit` \| `ignore` \| `approveAll` \| `status` \| `draftAnother` \| `closeCycle` | Parsed from Slack text |
| `proposalIndexes` | number[] | For approve/ignore/edit |
| `editedText` | string | For edit |
| `receivedAt` | ISO datetime | Audit in run output only |

**Validation** (FR-020):
- Unknown index → validation reply; no sends.
- Malformed command → helpful reply listing supported forms.

---

## ApprovedMessageDelivery

| Field | Type | Notes |
|-------|------|-------|
| `proposalIndex` | integer | |
| `finalMessageText` | string | Original or edited |
| `recipientSlackUserId` | string | |
| `dmChannelId` | string | From `conversations.open` |
| `sentMessageTs` | string | For reply correlation |
| `deliveryStatus` | `sent` \| `failed` \| `skipped` | FR-022 |
| `failureReason` | string | Machine-readable when failed/skipped |

---

## EngineerReply

| Field | Type | Notes |
|-------|------|-------|
| `deliveryRef` | proposalIndex | |
| `issueKey` | string | |
| `engineerDisplayName` | string | |
| `rawText` | string | Internal only; HR-adjacent content not quoted verbatim (FR-036) |
| `extraction` | string | On-topic summary or `no on-topic content extracted` |
| `blockerSignal` | string | Optional detected phrase |
| `recommendation` | ReplyRecommendation | FR-028 enum |
| `readStatus` | `read` \| `no reply yet within cycle window` \| `unreadable` | FR-027, FR-039 |

### ReplyRecommendation (FR-028)

`no further follow-up needed` | `another follow-up suggested (draft on request)` | `manager attention recommended`

---

## CycleReplySummary

Manager-facing aggregate produced on `status` command. Schema: [contracts/reply-summary.schema.json](./contracts/reply-summary.schema.json).

| Field | Type | Notes |
|-------|------|-------|
| `groupedByEngineer` | EngineerReplyGroup[] | FR-028 grouping |
| `dataLimitations` | DataLimitationNotice[] | FR-040 |

### EngineerReplyGroup

| Field | Type |
|-------|------|
| `engineerDisplayName` | string |
| `items` | `{ issueKey, extraction, blockerSignal?, recommendation, readStatus }[]` |

---

## InCycleContext (FR-030)

| Field | Type | Notes |
|-------|------|-------|
| `askedPairs` | `{ engineer, issueKey, reasonType, questionSummary, sentAt }[]` | De-duplication input |
| `capturedReplies` | `{ engineer, issueKey, extraction, capturedAt }[]` | Continuation draft input |

**Rules**:
- Before adding proposal, reject duplicate `(engineer, issueKey, reasonType)` — merge evidence instead (FR-031).
- Continuation drafts MUST reference matching `capturedReplies` entry when present.
- Discarded when cycle closes (FR-032) — never written to cross-cycle store.

---

## DataLimitationNotice

Same shape as feature 001:

| Field | Type | Example |
|-------|------|---------|
| `scope` | string | `Orion squad / proposal 3` |
| `reason` | string | `skipped: missing recipient mapping` |

Common entries: stale analysis, overflow proposals, missing Slack map, unreadable reply, unresolved Jira issue.

---

## Configuration Extensions

Optional block in `config/em-copilot.yml`:

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `communicationAssistant.analysisFreshnessHours` | integer > 0 | 24 | FR-009 |
| `communicationAssistant.maxProposalsPerCycle` | integer > 0 | 10 | FR-019 |
| `communicationAssistant.cycleMaxMinutes` | integer > 0 | 60 | Poll loop cap |
| `communicationAssistant.pollIntervalSeconds` | integer > 0 | 5 | Thread poll interval |
| `communicationAssistant.analysisArtifactDir` | string path | `.squadpulse/analysis` | Artifact location |

Squad-level `teamMemberSlackMap` remains on 001 Squad config (reused, not duplicated).

---

## Output: FollowUpRunResult

Extension of 001 RunResult for Cursor run history. Schema: [contracts/follow-up-run-result.schema.json](./contracts/follow-up-run-result.schema.json).

| Field | Type | Notes |
|-------|------|-------|
| `status` | `success` \| `error` \| `partial` | |
| `workflow` | `followups` | |
| `cycleId` | string | |
| `squadId` | string | |
| `proposalsGenerated` | integer | |
| `messagesSent` | integer | |
| `messagesSkipped` | integer | |
| `messagesFailed` | integer | |
| `failureReason` | string | When error |
| `slackDelivered` | boolean | Manager-facing posts succeeded |

---

## Normalized Slack Request (follow-up)

Parsed follow-up commands — separate from 001 analysis parse. Schema: [contracts/follow-up-slack-request.schema.json](./contracts/follow-up-slack-request.schema.json).

Kinds: `startCycle` | `approve` | `edit` | `ignore` | `approveAll` | `status` | `draftAnother` | `closeCycle` | `unknownSquad` | `unknownCommand` | `noActiveCycle`
