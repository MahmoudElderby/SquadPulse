import { z } from 'zod';

export const parsedAnalysisRequestSchema = z.object({
  kind: z.literal('analysis'),
  rawText: z.string().optional(),
  normalizedSquadToken: z.string().optional(),
  squadId: z.string(),
  squadDisplayName: z.string(),
  intent: z.enum(['full', 'sprint', 'blockers', 'stale', 'hygiene', 'follow-up']),
});

export const parsedErrorRequestSchema = z.object({
  kind: z.enum(['unknownSquad', 'unknownIntent', 'ambiguousSquad']),
  rawText: z.string().optional(),
  message: z.string(),
  configuredSquads: z
    .array(
      z.object({
        displayName: z.string(),
        aliases: z.array(z.string()),
      }),
    )
    .optional(),
  supportedIntents: z.array(z.string()).optional(),
});

export const parsedSlackRequestSchema = z.union([
  parsedAnalysisRequestSchema,
  parsedErrorRequestSchema,
]);

export type ParsedSlackRequest = z.infer<typeof parsedSlackRequestSchema>;
export type ParsedAnalysisRequest = z.infer<typeof parsedAnalysisRequestSchema>;
