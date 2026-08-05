import { z } from 'zod';
import { deterministicFindingsSchema } from './deterministic-findings.js';
import { followUpDraftSchema } from './contextual-analysis.js';
import { dataLimitationSchema } from './normalized-squad-snapshot.js';

export const squadSummarySchema = z.object({
  squadId: z.string(),
  displayName: z.string(),
  oneLineStatus: z.string(),
  healthStatus: z.enum(['On Track', 'Needs Attention', 'At Risk', 'Unavailable']),
});

export const crossSquadPrioritySchema = z.object({
  kind: z.enum(['linkedIssues', 'crossSquadBlockerOwner', 'sharedEpic']),
  issueKeys: z.array(z.string()).min(1),
  squads: z.tuple([z.string(), z.string()]),
  impactScore: z.number(),
  summary: z.string(),
});

export const dailyBriefingSchema = z.object({
  generatedAt: z.string().datetime(),
  timezone: z.string().default('UTC'),
  reportDate: z.string().date(),
  isRefresh: z.boolean(),
  squadSummaries: z.array(squadSummarySchema).length(2),
  crossSquadPriorities: z.array(crossSquadPrioritySchema),
  perSquadFindings: z
    .array(
      z.object({
        squadId: z.string(),
        findings: deterministicFindingsSchema,
        unavailable: z.boolean().optional(),
        unavailableReason: z.string().optional(),
      }),
    )
    .min(1)
    .max(2),
  standUpFocusItems: z.array(
    z.object({
      squadId: z.string(),
      focus: z.string(),
      relatedIssueKeys: z.array(z.string()).optional(),
    }),
  ).optional(),
  followUpDrafts: z.array(followUpDraftSchema).max(20).optional(),
  limitations: z.array(dataLimitationSchema),
});

export type DailyTwoSquadBriefing = z.infer<typeof dailyBriefingSchema>;
