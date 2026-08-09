import { z } from 'zod';
import { analysisScopeSchema } from './analysis-scope.js';

export const parsedAnalysisRequestSchema = z.object({
  kind: z.literal('analysis'),
  rawText: z.string().optional(),
  normalizedSquadToken: z.string().optional(),
  squadId: z.string(),
  squadDisplayName: z.string(),
  intent: z.enum(['full', 'sprint', 'blockers', 'stale', 'hygiene', 'follow-up']),
  /** Optional narrow filter (person, tickets, …) — portable across Slack/Jira prompts */
  scope: analysisScopeSchema.optional(),
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

/**
 * Transport-agnostic analysis request (Slack text, Jira automation prompt, JSON API).
 * Prefer this shape for new callers; Slack parser produces it from free text.
 */
export const analysisRequestSchema = z.object({
  squadId: z.string().optional(),
  squadDisplayName: z.string().optional(),
  /** Free-text token used to resolve squad when squadId omitted */
  squadToken: z.string().optional(),
  intent: z.enum(['full', 'sprint', 'blockers', 'stale', 'hygiene', 'follow-up']).default('full'),
  scope: analysisScopeSchema.optional(),
  rawText: z.string().optional(),
});

export type ParsedSlackRequest = z.infer<typeof parsedSlackRequestSchema>;
export type ParsedAnalysisRequest = z.infer<typeof parsedAnalysisRequestSchema>;
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
