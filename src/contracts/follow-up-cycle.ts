import { z } from 'zod';
import { followUpProposalSchema } from './follow-up-proposal.js';
import { dataLimitationSchema } from './normalized-squad-snapshot.js';

export const approvedMessageDeliverySchema = z.object({
  proposalIndex: z.number().int().min(1),
  finalMessageText: z.string(),
  recipientSlackUserId: z.string().optional(),
  dmChannelId: z.string().optional(),
  sentMessageTs: z.string().optional(),
  deliveryStatus: z.enum(['sent', 'failed', 'skipped']),
  failureReason: z.string().optional(),
});

export const inCycleContextSchema = z.object({
  askedPairs: z.array(
    z.object({
      engineer: z.string(),
      issueKey: z.string(),
      reasonType: z.string(),
      questionSummary: z.string(),
      sentAt: z.string().datetime().optional(),
    }),
  ),
  capturedReplies: z.array(
    z.object({
      engineer: z.string(),
      issueKey: z.string(),
      extraction: z.string(),
      capturedAt: z.string().datetime().optional(),
    }),
  ),
});

export const followUpCycleSchema = z.object({
  cycleId: z.string().uuid(),
  squadId: z.string(),
  managerThreadTs: z.string(),
  startedAt: z.string().datetime(),
  analysisConsumed: z.object({
    artifactPath: z.string(),
    analyzedAt: z.string().datetime(),
    possiblyStale: z.boolean().optional(),
  }),
  proposals: z.array(followUpProposalSchema),
  overflowCount: z.number().int().min(0).optional(),
  deliveries: z.array(approvedMessageDeliverySchema).optional(),
  inCycleContext: inCycleContextSchema,
  dataLimitations: z.array(dataLimitationSchema).optional(),
  status: z.enum(['active', 'closing', 'closed']),
});

export type ApprovedMessageDelivery = z.infer<typeof approvedMessageDeliverySchema>;
export type InCycleContext = z.infer<typeof inCycleContextSchema>;
export type FollowUpCycle = z.infer<typeof followUpCycleSchema>;
