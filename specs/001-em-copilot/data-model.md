# Data Model: Engineering Manager Copilot (MVP)

**Feature**: `001-em-copilot`  
**Date**: 2026-08-06

This document defines repository-internal entities. Nothing here is persisted to a database; all structures exist in memory for the duration of a single run unless sourced from Jira/Slack APIs.

## Entity Relationship Overview

```text
Configuration
  ├── GlobalSettings
  └── Squad[] (exactly 2 in MVP)
        ├── BoardRef[] (≥1 Scrum and/or Kanban)
        ├── StatusCategoryMapping
        ├── PriorityMapping
        └── Thresholds

WorkItem (normalized from Jira)
  ├── belongs to Squad
  ├── optional Sprint
  └── links → WorkItem

DeterministicFindings (per squad)
  ├── DeliveryRisk[]
  ├── BlockerDependency[]
  ├── JiraHygieneFinding[]
  ├── WorkloadFlowSignal[]
  ├── SquadHealthClassification
  └── DataLimitationNotice[]

ContextualAnalysis (AI, validated)
  ├── StandUpFocusItem[]
  └── FollowUpDraft[]

SquadReport / DailyBriefing (rendered Slack output)
```

---

## Configuration

### GlobalSettings

| Field | Type | Required | Validation / Notes |
|-------|------|----------|-------------------|
| `jira.baseUrl` | string (URL) | yes | Must match `JIRA_BASE_URL` host |
| `slack.managerDestination` | string | yes | Slack channel/DM ID (`C…`, `G…`, or `D…`) |
| `schedule.timezone` | IANA string | no | Default `UTC` |
| `schedule.workingDays` | int[] (1=Mon…7=Sun) | no | Default `[1,2,3,4,5]` |
| `schedule.dailyBriefingTime` | `HH:mm` | no | Default `08:30` |
| `secrets.envVarNames` | object | no | Overrides for FR-041 defaults |

### Squad

| Field | Type | Required | Validation / Notes |
|-------|------|----------|-------------------|
| `id` | string | yes | Stable slug, unique |
| `displayName` | string | yes | Used in reports and Slack resolution |
| `aliases` | string[] | no | Case-insensitive unique across all squads |
| `projectKeys` | string[] | yes | Jira project scope (FR-042) |
| `scrumBoardId` | number | no* | *At least one of scrum/kanban required |
| `kanbanBoardId` | number | no* | |
| `statusCategories` | StatusCategoryMapping | yes | Maps Jira status names → category enum |
| `priorityMapping` | PriorityMapping | yes | Maps Jira priority names → `P0`…`P4` |
| `blockerFieldId` | string | no | Custom field or link type for blockers |
| `dependencyLinkTypes` | string[] | no | e.g. `blocks`, `is blocked by` |
| `teamMemberSlackMap` | Record<displayName, slackUserId> | no | For draft `@mention` hints |
| `thresholds.staleInProgressBusinessDays` | number | no | Default 5 |
| `thresholds.noMeaningfulUpdateBusinessDays` | number | no | Default 3 |
| `thresholds.maxInProgressPerPerson` | number | no | Default 3 |
| `schedule.timezone` | IANA string | no | Overrides global |
| `schedule.workingDays` | int[] | no | Overrides global |

**Validation rules** (FR-009, SC-010):
- Reject overlapping aliases across squads.
- Reject squad with neither `scrumBoardId` nor `kanbanBoardId`.
- Reject unknown status names at first live validation (or fixture validation in tests).

### StatusCategoryMapping

| Category | Description |
|----------|-------------|
| `notStarted` | Status names counted as not started |
| `inProgress` | Active development |
| `blocked` | Explicit blocked statuses |
| `reviewOrHandoff` | Review / QA / handoff |
| `done` | Terminal done statuses |

### PriorityMapping

Maps Jira priority display names to internal tiers: `P0`, `P1`, `P2`, `P3`, `P4`. Used for health rules (unowned P0/P1 blocker, unassigned P0/P1-tier sprint work per FR-015).

---

## Jira-Derived Entities

### BoardRef

| Field | Type | Notes |
|-------|------|-------|
| `type` | `scrum` \| `kanban` | |
| `boardId` | number | Jira board ID |
| `squadId` | string | Parent squad |

### Sprint

| Field | Type | Notes |
|-------|------|-------|
| `id` | number | Jira sprint ID |
| `name` | string | |
| `state` | `active` \| `closed` \| `future` | |
| `startDate` | ISO datetime | |
| `endDate` | ISO datetime | |
| `boardId` | number | |

**Derived**: `elapsedFraction` = elapsed calendar time / sprint duration (for 50% sprint rule in FR-015).

### WorkItem (normalized)

| Field | Type | Notes |
|-------|------|-------|
| `key` | string | e.g. `PAY-123` |
| `summary` | string | |
| `projectKey` | string | |
| `boardId` | number | Source board |
| `boardType` | `scrum` \| `kanban` | |
| `sprintIds` | number[] | Empty for Kanban-only items |
| `issueType` | string | |
| `priorityTier` | `P0`…`P4` | From PriorityMapping |
| `statusName` | string | Raw Jira status |
| `statusCategory` | enum | From StatusCategoryMapping |
| `assigneeDisplayName` | string \| null | |
| `assigneeAccountId` | string \| null | |
| `storyPoints` | number \| null | Or time estimate normalized |
| `createdAt` | ISO datetime | |
| `updatedAt` | ISO datetime | |
| `statusChangedAt` | ISO datetime \| null | From changelog when available |
| `ageInCurrentStatusBusinessDays` | number | Computed |
| `daysSinceMeaningfulUpdate` | number | Computed |
| `labels` | string[] | |
| `components` | string[] | |
| `parentKey` | string \| null | |
| `subtaskKeys` | string[] | |
| `linkedIssues` | LinkedIssue[] | |
| `isBlockedFlag` | boolean | From blocker field |
| `blockerMentionInComments` | boolean | Hygiene signal |
| `addedAfterSprintStart` | boolean \| null | When derivable |
| `wasInPreviousSprint` | boolean | Carryover signal |
| `resolution` | string \| null | |
| `latestCommentExcerpt` | string \| null | Truncated, non-secret |

### LinkedIssue

| Field | Type | Notes |
|-------|------|-------|
| `key` | string | |
| `linkType` | string | |
| `direction` | `outward` \| `inward` | |
| `otherSquadId` | string \| null | Set when link crosses squads |

---

## Analysis Entities

### DeliveryRisk

| Field | Type | Validation |
|-------|------|------------|
| `id` | string | Stable hash of category + keys |
| `category` | enum | See categories in FR-026 |
| `issueKeys` | string[] | ≥1 required (FR-030) |
| `evidence` | string[] | Human-readable evidence bullets |
| `impact` | string | Neutral impact statement |
| `recommendedAction` | string | Required manager action (FR-035) |
| `impactScore` | number | For sorting; not shown to manager |

**Categories**: `staleInProgress`, `noRecentUpdate`, `unownedBlocker`, `unassignedCritical`, `lateStart`, `crossSquadDependency`, `subtaskInconsistency`, `statusThrash`, `unplannedScope`.

### BlockerDependency

| Field | Type | Notes |
|-------|------|-------|
| `issueKey` | string | |
| `blockedByKeys` | string[] | |
| `dependencyOwner` | string \| null | |
| `expectedResolutionDate` | ISO date \| null | |
| `isOwned` | boolean | |

### JiraHygieneFinding

| Field | Type | Notes |
|-------|------|-------|
| `issueKey` | string | |
| `category` | enum | FR-027 categories |
| `evidence` | string | |
| `suggestedAction` | string | |

**Rule**: Hygiene alone MUST NOT change `SquadHealthClassification` (FR-028).

### WorkloadFlowSignal

| Field | Type | Notes |
|-------|------|-------|
| `signalType` | enum | FR-029 types |
| `description` | string | Neutral wording (FR-032) |
| `relatedIssueKeys` | string[] | Optional |

### SquadHealthClassification

| Field | Type | Validation |
|-------|------|------------|
| `status` | `On Track` \| `Needs Attention` \| `At Risk` | Exactly one |
| `reasons` | string[] | ≥1 when not On Track |
| `deliveryRiskCount` | number | Used for classification |

**State transitions** (deterministic, FR-015):

```text
deliveryRiskCount = 0                          → On Track
deliveryRiskCount ∈ {1,2} AND no At Risk gates → Needs Attention
≥3 risks OR unowned P0/P1 blocker OR unassigned P0/P1-tier sprint work after 50% sprint → At Risk
```

### CrossSquadPriority

| Field | Type | Notes |
|-------|------|-------|
| `kind` | `linkedIssues` \| `crossSquadBlockerOwner` \| `sharedEpic` | FR-017 |
| `issueKeys` | string[] | |
| `squads` | [string, string] | Both squad IDs |
| `impactScore` | number | Sort key |
| `summary` | string | |

---

## AI Output (validated before render)

### ContextualAnalysis

| Field | Type | Notes |
|-------|------|-------|
| `standUpFocusItems` | StandUpFocusItem[] | Daily briefing only |
| `followUpDrafts` | FollowUpDraft[] | |
| `keyFactsNarrative` | string[] | Optional bullets augmenting deterministic key facts |

### FollowUpDraft

| Field | Type | Validation |
|-------|------|------------|
| `recipientDisplayName` | string | Group key |
| `issueKeys` | string[] | ≥1 |
| `observation` | string | Neutral tone |
| `request` | string | Specific info requested |
| `draftType` | `delivery` \| `hygiene` \| `dependency` | |

**Constraints**: Max 10 per squad report, 20 daily (FR-022); never auto-sent (FR-023).

---

## Output Artifacts

### SquadReport

Rendered Slack Markdown with fixed section order (FR-014): header → health → key facts → risks → blockers → flow → hygiene → actions → drafts → data limitations.

List caps: top 5 per list section; overflow line appended.

### DailyTwoSquadBriefing

Sections per FR-017. Includes refresh label when same-day re-run (FR-018).

### DataLimitationNotice

| Field | Type | Example |
|-------|------|---------|
| `scope` | string | `Payments squad / changelog` |
| `reason` | string | `Permission denied for issue history` |

### RunResult (execution contract)

| Field | Type | Notes |
|-------|------|-------|
| `status` | `success` \| `error` \| `partial` | |
| `workflow` | `on-demand` \| `daily` | |
| `failureReason` | string | Machine-readable code |
| `slackDelivered` | boolean | false if post failed after analysis |
| `squadsAnalyzed` | string[] | |

---

## Normalized Snapshot (pipeline interchange)

`NormalizedSquadSnapshot` aggregates per squad:

- `squad` (config subset)
- `sprints`: Sprint[]
- `workItems`: WorkItem[]
- `retrievalMeta`: `{ truncated: boolean, issueCount: number, cap: 500 }`
- `limitations`: DataLimitationNotice[]

This is the primary input to both the deterministic rule engine and the AI contextual prompt.
