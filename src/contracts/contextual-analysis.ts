import { z } from 'zod';

export const followUpDraftSchema = z.object({
  recipientDisplayName: z.string().min(1),
  issueKeys: z.array(z.string()).min(1),
  observation: z.string().min(1),
  request: z.string().min(1),
  draftType: z.enum(['delivery', 'hygiene', 'dependency']),
});

export const standUpFocusItemSchema = z.object({
  squadId: z.string(),
  focus: z.string(),
  relatedIssueKeys: z.array(z.string()).optional(),
});

export const contextualAnalysisSchema = z.object({
  keyFactsNarrative: z.array(z.string()).optional(),
  standUpFocusItems: z.array(standUpFocusItemSchema).optional(),
  followUpDrafts: z.array(followUpDraftSchema),
});

export type ContextualAnalysis = z.infer<typeof contextualAnalysisSchema>;
export type FollowUpDraft = z.infer<typeof followUpDraftSchema>;
