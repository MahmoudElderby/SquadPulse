import type { FollowUpCycle } from '../contracts/follow-up-cycle.js';
import type { FollowUpProposal } from '../contracts/follow-up-proposal.js';
import type { ParsedFollowUpSlackRequest } from '../contracts/follow-up-slack-request.js';

export interface CommandResult {
  ok: boolean;
  message: string;
  cycle: FollowUpCycle;
  shouldClose?: boolean;
  shouldSendApproved?: boolean;
  shouldStatus?: boolean;
  draftAnotherIndex?: number;
}

function findProposal(cycle: FollowUpCycle, index: number): FollowUpProposal | undefined {
  return cycle.proposals.find((p) => p.index === index);
}

function validateIndexes(cycle: FollowUpCycle, indexes: number[]): string | null {
  for (const idx of indexes) {
    if (!findProposal(cycle, idx)) {
      const max = cycle.proposals.length;
      return `Unknown proposal index ${idx}. Valid range: 1–${max || 'none'}.`;
    }
  }
  return null;
}

function approveProposal(proposal: FollowUpProposal): FollowUpProposal {
  if (proposal.status === 'ignored') return proposal;
  return { ...proposal, status: 'approved' };
}

export function processManagerCommand(
  cycle: FollowUpCycle,
  request: ParsedFollowUpSlackRequest,
): CommandResult {
  if (request.kind === 'closeCycle') {
    return {
      ok: true,
      message: 'Closing follow-up cycle.',
      cycle: { ...cycle, status: 'closing' },
      shouldClose: true,
    };
  }

  if (request.kind === 'status') {
    return {
      ok: true,
      message: 'Reading engineer replies…',
      cycle,
      shouldStatus: true,
    };
  }

  if (request.kind === 'approveAll') {
    const proposals = cycle.proposals.map((p) =>
      p.status === 'pending' || p.status === 'approved' ? approveProposal(p) : p,
    );
    return {
      ok: true,
      message: `Approved all ${proposals.filter((p) => p.status === 'approved').length} pending proposal(s). Reply with \`done\` when finished, or send more approvals.`,
      cycle: { ...cycle, proposals },
      shouldSendApproved: true,
    };
  }

  if (request.kind === 'approve') {
    const indexes = request.proposalIndexes ?? [];
    const err = validateIndexes(cycle, indexes);
    if (err) {
      return { ok: false, message: err, cycle };
    }
    const proposals = cycle.proposals.map((p) =>
      indexes.includes(p.index) ? approveProposal(p) : p,
    );
    return {
      ok: true,
      message: `Approved proposal(s): ${indexes.join(', ')}.`,
      cycle: { ...cycle, proposals },
      shouldSendApproved: true,
    };
  }

  if (request.kind === 'ignore') {
    const indexes = request.proposalIndexes ?? [];
    const err = validateIndexes(cycle, indexes);
    if (err) {
      return { ok: false, message: err, cycle };
    }
    const proposals = cycle.proposals.map((p) =>
      indexes.includes(p.index) ? { ...p, status: 'ignored' as const } : p,
    );
    return {
      ok: true,
      message: `Ignored proposal(s): ${indexes.join(', ')}.`,
      cycle: { ...cycle, proposals },
    };
  }

  if (request.kind === 'edit') {
    const indexes = request.proposalIndexes ?? [];
    const err = validateIndexes(cycle, indexes);
    if (err) {
      return { ok: false, message: err, cycle };
    }
    if (!request.editedText?.trim()) {
      return { ok: false, message: 'Edit command requires text after the colon.', cycle };
    }
    const proposals = cycle.proposals.map((p) =>
      indexes.includes(p.index)
        ? { ...p, editedMessage: request.editedText!.trim(), status: 'pending' as const }
        : p,
    );
    return {
      ok: true,
      message: `Updated draft for proposal ${indexes.join(', ')}. Use \`approve ${indexes.join(',')}\` to send.`,
      cycle: { ...cycle, proposals },
    };
  }

  if (request.kind === 'draftAnother') {
    const indexes = request.proposalIndexes ?? [];
    const err = validateIndexes(cycle, indexes);
    if (err) {
      return { ok: false, message: err, cycle };
    }
    return {
      ok: true,
      message: `Generating continuation draft for proposal ${indexes[0]}…`,
      cycle,
      draftAnotherIndex: indexes[0],
    };
  }

  if (
    request.kind === 'unknownCommand' ||
    request.kind === 'unknownSquad' ||
    request.kind === 'noActiveCycle' ||
    request.kind === 'ambiguousSquad'
  ) {
    return {
      ok: false,
      message: request.message,
      cycle,
    };
  }

  return { ok: false, message: 'Command not handled in active cycle.', cycle };
}

export function getApprovedPendingSend(cycle: FollowUpCycle): FollowUpProposal[] {
  return cycle.proposals.filter((p) => p.status === 'approved');
}
