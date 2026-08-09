import { z } from 'zod';

export const followUpRunResultSchema = z.object({
  status: z.enum(['success', 'error', 'partial']),
  workflow: z.literal('followups'),
  slackDelivered: z.boolean(),
  cycleId: z.string().uuid().optional(),
  squadId: z.string().optional(),
  proposalsGenerated: z.number().int().min(0).optional(),
  messagesSent: z.number().int().min(0).optional(),
  messagesSkipped: z.number().int().min(0).optional(),
  messagesFailed: z.number().int().min(0).optional(),
  failureReason: z.string().optional(),
  previewSnippet: z.string().max(500).optional(),
});

export type FollowUpRunResult = z.infer<typeof followUpRunResultSchema>;
