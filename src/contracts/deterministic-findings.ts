import { z } from 'zod';
import { dataLimitationSchema } from './normalized-squad-snapshot.js';

export const deliveryRiskCategoryEnum = z.enum([
  'staleInProgress',
  'noRecentUpdate',
  'unownedBlocker',
  'unassignedCritical',
  'lateStart',
  'crossSquadDependency',
  'subtaskInconsistency',
  'statusThrash',
  'unplannedScope',
]);

export const deliveryRiskSchema = z.object({
  category: deliveryRiskCategoryEnum,
  issueKeys: z.array(z.string()).min(1),
  evidence: z.array(z.string()).min(1),
  impact: z.string(),
  recommendedAction: z.string(),
  impactScore: z.number(),
});

export const blockerSchema = z.object({
  issueKey: z.string(),
  blockedByKeys: z.array(z.string()).optional(),
  dependencyOwner: z.string().nullable().optional(),
  expectedResolutionDate: z.string().date().nullable().optional(),
  isOwned: z.boolean().optional(),
});

export const hygieneFindingSchema = z.object({
  issueKey: z.string(),
  category: z.enum([
    'missingEstimate',
    'missingAssignee',
    'unclearAcceptanceCriteria',
    'statusInconsistency',
    'unstructuredBlockerMention',
    'completedStillOpen',
    'staleComments',
  ]),
  evidence: z.string(),
  suggestedAction: z.string().optional(),
});

export const flowSignalSchema = z.object({
  signalType: z.enum([
    'wipOverload',
    'criticalConcentration',
    'reviewBottleneck',
    'unownedUrgentQueue',
    'externalDependencyCluster',
  ]),
  description: z.string(),
  relatedIssueKeys: z.array(z.string()).optional(),
});

export const managerActionSchema = z.object({
  priority: z.number().int().min(1),
  action: z.string(),
  relatedIssueKeys: z.array(z.string()),
});

export const healthSchema = z.object({
  status: z.enum(['On Track', 'Needs Attention', 'At Risk']),
  reasons: z.array(z.string()),
  deliveryRiskCount: z.number().int().min(0),
});

export const deterministicFindingsSchema = z.object({
  squadId: z.string(),
  health: healthSchema,
  keyFacts: z.array(z.string()).optional(),
  deliveryRisks: z.array(deliveryRiskSchema),
  blockers: z.array(blockerSchema),
  hygieneFindings: z.array(hygieneFindingSchema),
  flowSignals: z.array(flowSignalSchema),
  managerActions: z.array(managerActionSchema),
  limitations: z.array(dataLimitationSchema).optional(),
});

export type DeterministicFindings = z.infer<typeof deterministicFindingsSchema>;
export type DeliveryRisk = z.infer<typeof deliveryRiskSchema>;
export type HygieneFinding = z.infer<typeof hygieneFindingSchema>;
export type FlowSignal = z.infer<typeof flowSignalSchema>;
export type Blocker = z.infer<typeof blockerSchema>;
export type ManagerAction = z.infer<typeof managerActionSchema>;
