import type { SquadConfig } from '../contracts/config.js';
import type {
  NormalizedSquadSnapshot,
  WorkItem,
} from '../contracts/normalized-squad-snapshot.js';
import type { JiraIssue } from './client.js';
import { sprintElapsedFraction } from '../lib/datetime.js';

type StatusCategory = WorkItem['statusCategory'];

interface NormalizeInput {
  squad: SquadConfig;
  issues: JiraIssue[];
  timezone: string;
  allSquadIds: string[];
  retrievalMeta: NormalizedSquadSnapshot['retrievalMeta'];
  activeSprint?: NormalizedSquadSnapshot['activeSprint'];
  previousSprint?: NormalizedSquadSnapshot['previousSprint'];
}

function mapStatusCategory(statusName: string, squad: SquadConfig): StatusCategory {
  const cats = squad.statusCategories;
  for (const [category, names] of Object.entries(cats) as [StatusCategory, string[]][]) {
    if (names.some((n) => n.toLowerCase() === statusName.toLowerCase())) {
      return category;
    }
  }
  return 'notStarted';
}

function mapPriorityTier(priorityName: string | undefined, squad: SquadConfig): WorkItem['priorityTier'] {
  if (!priorityName) return 'P3';
  for (const [tier, names] of Object.entries(squad.priorityMapping) as [WorkItem['priorityTier'], string[]][]) {
    if (names.some((n) => n.toLowerCase() === priorityName.toLowerCase())) {
      return tier;
    }
  }
  return 'P3';
}

function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export function normalizeIssues(input: NormalizeInput): NormalizedSquadSnapshot {
  const { squad, issues, timezone, allSquadIds, retrievalMeta, activeSprint, previousSprint } = input;

  const workItems: WorkItem[] = issues.map((issue) => {
    const statusName = issue.fields.status.name;
    const statusCategory = mapStatusCategory(statusName, squad);
    const priorityTier = mapPriorityTier(issue.fields.priority?.name, squad);
    const comments = issue.fields.comment?.comments ?? [];
    const latestComment = comments[comments.length - 1];
    const commentText = latestComment ? JSON.stringify(latestComment.body).slice(0, 200) : null;

    return {
      key: issue.key,
      summary: issue.fields.summary,
      projectKey: issue.key.split('-')[0],
      boardType: squad.scrumBoardId ? 'scrum' as const : 'kanban' as const,
      sprintIds: activeSprint ? [activeSprint.id] : [],
      issueType: issue.fields.issuetype.name,
      priorityTier,
      statusName,
      statusCategory,
      assigneeDisplayName: issue.fields.assignee?.displayName ?? null,
      storyPoints: issue.fields.customfield_10016 ?? null,
      createdAt: issue.fields.created,
      updatedAt: issue.fields.updated,
      ageInCurrentStatusBusinessDays: daysSince(issue.fields.updated),
      daysSinceMeaningfulUpdate: daysSince(issue.fields.updated),
      labels: issue.fields.labels ?? [],
      components: issue.fields.components?.map((c) => c.name) ?? [],
      parentKey: issue.fields.parent?.key ?? null,
      subtaskKeys: [],
      linkedIssues: [],
      isBlockedFlag: statusCategory === 'blocked',
      blockerMentionInComments: commentText?.toLowerCase().includes('block') ?? false,
      addedAfterSprintStart: null,
      wasInPreviousSprint: false,
      resolution: issue.fields.resolution?.name ?? null,
      latestCommentExcerpt: commentText,
    };
  });

  const active = activeSprint
    ? {
        ...activeSprint,
        elapsedFraction: sprintElapsedFraction(activeSprint.startDate, activeSprint.endDate),
      }
    : undefined;

  return {
    squadId: squad.id,
    displayName: squad.displayName,
    generatedAt: new Date().toISOString(),
    timezone,
    activeSprint: active,
    previousSprint,
    workItems,
    retrievalMeta,
    limitations: [],
  };
}

export function normalizeFromFixture(raw: unknown): NormalizedSquadSnapshot {
  const data = raw as NormalizedSquadSnapshot;
  if (data.activeSprint && !data.activeSprint.elapsedFraction) {
    data.activeSprint.elapsedFraction = sprintElapsedFraction(
      data.activeSprint.startDate,
      data.activeSprint.endDate,
    );
  }
  return data;
}
