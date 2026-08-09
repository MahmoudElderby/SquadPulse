import { z } from 'zod';

export const followUpReasonTypeEnum = z.enum([
  'progress-update',
  'blocker-clarification',
  'estimate-reminder',
  'jira-status-reminder',
  'dependency-follow-up',
  'sprint-risk-clarification',
]);

export const evidenceRefSchema = z.object({
  source: z.enum(['deliveryRisk', 'blocker', 'hygieneFinding', 'contextualDraft']),
  issueKey: z.string(),
  summary: z.string().min(1),
});

export const proposalStatusEnum = z.enum([
  'pending',
  'approved',
  'ignored',
  'sent',
  'failed',
  'skipped',
]);

export const followUpProposalSchema = z.object({
  index: z.number().int().min(1),
  issueKey: z.string().min(1),
  engineerDisplayName: z.string().min(1),
  slackUserId: z.string().regex(/^U[A-Z0-9]+$/).optional(),
  reasonType: followUpReasonTypeEnum,
  draftMessage: z.string().min(1).max(3000),
  confidence: z.enum(['Low', 'Medium', 'High']),
  urgency: z.enum(['Low', 'Medium', 'High']),
  evidence: z.array(evidenceRefSchema).min(1),
  status: proposalStatusEnum,
  editedMessage: z.string().max(3000).optional(),
});

export type FollowUpReasonType = z.infer<typeof followUpReasonTypeEnum>;
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;
export type FollowUpProposal = z.infer<typeof followUpProposalSchema>;
export type ProposalStatus = z.infer<typeof proposalStatusEnum>;
