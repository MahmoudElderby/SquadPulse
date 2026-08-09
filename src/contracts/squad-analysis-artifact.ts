import { z } from 'zod';
import { deterministicFindingsSchema } from './deterministic-findings.js';
import { contextualAnalysisSchema } from './contextual-analysis.js';
import { dataLimitationSchema } from './normalized-squad-snapshot.js';

const artifactWorkItemSchema = z.object({
  key: z.string(),
  summary: z.string(),
  status: z.string(),
  priorityTier: z.enum(['P0', 'P1', 'P2', 'P3', 'P4']),
  assigneeDisplayName: z.string().nullable().optional(),
  storyPoints: z.number().nullable().optional(),
  updatedAt: z.string().datetime().optional(),
});

const artifactSprintSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  state: z.enum(['active', 'closed', 'future']),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const squadAnalysisArtifactSchema = z.object({
  squadId: z.string().min(1),
  squadDisplayName: z.string().min(1),
  analyzedAt: z.string().datetime(),
  workflow: z.enum(['on-demand', 'daily']),
  snapshot: z.object({
    sprints: z.array(artifactSprintSchema).optional(),
    workItems: z.array(artifactWorkItemSchema),
  }),
  deterministicFindings: deterministicFindingsSchema,
  contextualAnalysis: contextualAnalysisSchema.optional(),
  limitations: z.array(dataLimitationSchema).optional(),
});

export type SquadAnalysisArtifact = z.infer<typeof squadAnalysisArtifactSchema>;
