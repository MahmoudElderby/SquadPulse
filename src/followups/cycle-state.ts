import { randomUUID } from 'node:crypto';
import type { FollowUpCycle, InCycleContext, ApprovedMessageDelivery } from '../contracts/follow-up-cycle.js';
import type { FollowUpProposal } from '../contracts/follow-up-proposal.js';

export function createEmptyInCycleContext(): InCycleContext {
  return { askedPairs: [], capturedReplies: [] };
}

export interface CreateCycleInput {
  squadId: string;
  managerThreadTs: string;
  artifactPath: string;
  analyzedAt: string;
  possiblyStale: boolean;
  proposals: FollowUpProposal[];
  overflowCount?: number;
  dataLimitations?: { scope: string; reason: string }[];
}

export function createFollowUpCycle(input: CreateCycleInput): FollowUpCycle {
  return {
    cycleId: randomUUID(),
    squadId: input.squadId,
    managerThreadTs: input.managerThreadTs,
    startedAt: new Date().toISOString(),
    analysisConsumed: {
      artifactPath: input.artifactPath,
      analyzedAt: input.analyzedAt,
      possiblyStale: input.possiblyStale,
    },
    proposals: input.proposals,
    overflowCount: input.overflowCount,
    deliveries: [],
    inCycleContext: createEmptyInCycleContext(),
    dataLimitations: input.dataLimitations,
    status: 'active',
  };
}

export function renumberProposals(proposals: FollowUpProposal[]): FollowUpProposal[] {
  return proposals.map((p, i) => ({ ...p, index: i + 1 }));
}

export function addContinuationProposal(
  cycle: FollowUpCycle,
  proposal: FollowUpProposal,
): FollowUpCycle {
  const nextIndex = cycle.proposals.length + 1;
  const newProposal = { ...proposal, index: nextIndex, status: 'pending' as const };
  return {
    ...cycle,
    proposals: [...cycle.proposals, newProposal],
  };
}

export function recordSentDelivery(
  cycle: FollowUpCycle,
  delivery: ApprovedMessageDelivery,
  proposal: FollowUpProposal,
): FollowUpCycle {
  const deliveries = [...(cycle.deliveries ?? []), delivery];
  const askedPairs = [
    ...cycle.inCycleContext.askedPairs,
    {
      engineer: proposal.engineerDisplayName,
      issueKey: proposal.issueKey,
      reasonType: proposal.reasonType,
      questionSummary: proposal.editedMessage ?? proposal.draftMessage,
      sentAt: new Date().toISOString(),
    },
  ];
  return {
    ...cycle,
    deliveries,
    inCycleContext: { ...cycle.inCycleContext, askedPairs },
  };
}

export function recordCapturedReply(
  cycle: FollowUpCycle,
  engineer: string,
  issueKey: string,
  extraction: string,
): FollowUpCycle {
  const capturedReplies = [
    ...cycle.inCycleContext.capturedReplies.filter(
      (r) => !(r.engineer === engineer && r.issueKey === issueKey),
    ),
    { engineer, issueKey, extraction, capturedAt: new Date().toISOString() },
  ];
  return {
    ...cycle,
    inCycleContext: { ...cycle.inCycleContext, capturedReplies },
  };
}

export function allProposalsTerminal(cycle: FollowUpCycle): boolean {
  return cycle.proposals.every((p) =>
    ['sent', 'failed', 'skipped', 'ignored'].includes(p.status),
  );
}
