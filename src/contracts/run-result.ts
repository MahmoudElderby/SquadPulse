import { z } from 'zod';

export const runResultSchema = z.object({
  status: z.enum(['success', 'error', 'partial']),
  workflow: z.enum(['on-demand', 'daily']),
  slackDelivered: z.boolean(),
  failureReason: z.string().optional(),
  squadsAnalyzed: z.array(z.string()).optional(),
  squadsFailed: z
    .array(
      z.object({
        squadId: z.string(),
        reason: z.string(),
      }),
    )
    .optional(),
  isRefresh: z.boolean().optional(),
  reportPreview: z.string().optional(),
});

export type RunResult = z.infer<typeof runResultSchema>;
