import type { FollowUpProposal } from '../contracts/follow-up-proposal.js';
import type { InCycleContext } from '../contracts/follow-up-cycle.js';
import { validateFollowUpProposalDraft } from '../ai/validate-followup-proposal.js';

export interface ComposeOptions {
  fixtureMode?: boolean;
  priorReply?: { extraction: string };
}

export function composeProposalDrafts(
  proposals: FollowUpProposal[],
  inCycleContext?: InCycleContext,
  options: ComposeOptions = {},
): FollowUpProposal[] {
  return proposals.map((proposal) => composeSingleDraft(proposal, inCycleContext, options));
}

function composeSingleDraft(
  proposal: FollowUpProposal,
  inCycleContext?: InCycleContext,
  options: ComposeOptions = {},
): FollowUpProposal {
  let draft = proposal.editedMessage ?? proposal.draftMessage;

  const prior =
    options.priorReply ??
    inCycleContext?.capturedReplies.find(
      (r) => r.engineer === proposal.engineerDisplayName && r.issueKey === proposal.issueKey,
    );

  if (prior?.extraction) {
    draft = `${draft} (Following up on your earlier note: ${prior.extraction})`;
  }

  if (options.fixtureMode) {
    const validation = validateFollowUpProposalDraft({ ...proposal, draftMessage: draft });
    if (!validation.valid) {
      draft = proposal.draftMessage;
    }
  }

  return { ...proposal, draftMessage: draft };
}

export function buildContinuationDraft(
  baseProposal: FollowUpProposal,
  inCycleContext: InCycleContext,
): FollowUpProposal {
  const prior = inCycleContext.capturedReplies.find(
    (r) => r.engineer === baseProposal.engineerDisplayName && r.issueKey === baseProposal.issueKey,
  );
  const continuationText = prior
    ? `Hi ${baseProposal.engineerDisplayName}, thanks for the update on ${baseProposal.issueKey}. Could you share next steps regarding: ${prior.extraction}?`
    : `Hi ${baseProposal.engineerDisplayName}, following up on ${baseProposal.issueKey} — could you share any additional details?`;

  return {
    ...baseProposal,
    draftMessage: continuationText,
    editedMessage: undefined,
    status: 'pending',
    reasonType: baseProposal.reasonType,
  };
}
