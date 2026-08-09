import { z } from 'zod';
import { dataLimitationSchema } from './normalized-squad-snapshot.js';

export const replyRecommendationEnum = z.enum([
  'no further follow-up needed',
  'another follow-up suggested (draft on request)',
  'manager attention recommended',
]);

export const replySummaryItemSchema = z.object({
  issueKey: z.string(),
  extraction: z.string(),
  blockerSignal: z.string().optional(),
  recommendation: replyRecommendationEnum,
  readStatus: z.enum(['read', 'no reply yet within cycle window', 'unreadable']),
  unreadableReason: z.string().optional(),
});

export const engineerReplyGroupSchema = z.object({
  engineerDisplayName: z.string(),
  items: z.array(replySummaryItemSchema),
});

export const cycleReplySummarySchema = z.object({
  groupedByEngineer: z.array(engineerReplyGroupSchema),
  dataLimitations: z.array(dataLimitationSchema).optional(),
});

export type ReplyRecommendation = z.infer<typeof replyRecommendationEnum>;
export type ReplySummaryItem = z.infer<typeof replySummaryItemSchema>;
export type CycleReplySummary = z.infer<typeof cycleReplySummarySchema>;
