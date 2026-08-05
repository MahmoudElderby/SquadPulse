import { z } from 'zod';

export const statusCategoryEnum = z.enum([
  'notStarted',
  'inProgress',
  'blocked',
  'reviewOrHandoff',
  'done',
]);

export const sprintSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  state: z.enum(['active', 'closed', 'future']),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  elapsedFraction: z.number().min(0).max(1).optional(),
});

export const linkedIssueSchema = z.object({
  key: z.string(),
  linkType: z.string(),
  otherSquadId: z.string().nullable().optional(),
});

export const workItemSchema = z.object({
  key: z.string(),
  summary: z.string(),
  projectKey: z.string(),
  boardId: z.number().int().optional(),
  boardType: z.enum(['scrum', 'kanban']),
  sprintIds: z.array(z.number().int()).optional(),
  issueType: z.string().optional(),
  priorityTier: z.enum(['P0', 'P1', 'P2', 'P3', 'P4']),
  statusName: z.string(),
  statusCategory: statusCategoryEnum,
  assigneeDisplayName: z.string().nullable().optional(),
  storyPoints: z.number().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  ageInCurrentStatusBusinessDays: z.number().min(0).optional(),
  daysSinceMeaningfulUpdate: z.number().min(0).optional(),
  labels: z.array(z.string()).optional(),
  components: z.array(z.string()).optional(),
  parentKey: z.string().nullable().optional(),
  subtaskKeys: z.array(z.string()).optional(),
  linkedIssues: z.array(linkedIssueSchema).optional(),
  isBlockedFlag: z.boolean().optional(),
  blockerMentionInComments: z.boolean().optional(),
  addedAfterSprintStart: z.boolean().nullable().optional(),
  wasInPreviousSprint: z.boolean().optional(),
  resolution: z.string().nullable().optional(),
  latestCommentExcerpt: z.string().nullable().optional(),
});

export const dataLimitationSchema = z.object({
  scope: z.string(),
  reason: z.string(),
});

export const normalizedSquadSnapshotSchema = z.object({
  squadId: z.string(),
  displayName: z.string(),
  generatedAt: z.string().datetime(),
  timezone: z.string().default('UTC'),
  activeSprint: sprintSchema.optional(),
  previousSprint: sprintSchema.optional(),
  workItems: z.array(workItemSchema),
  retrievalMeta: z.object({
    issueCount: z.number().int().min(0),
    cap: z.literal(500),
    truncated: z.boolean(),
    scrumScope: z.string().optional(),
    kanbanScope: z.string().optional(),
  }),
  limitations: z.array(dataLimitationSchema).optional(),
});

export type NormalizedSquadSnapshot = z.infer<typeof normalizedSquadSnapshotSchema>;
export type WorkItem = z.infer<typeof workItemSchema>;
export type Sprint = z.infer<typeof sprintSchema>;
