import { describe, it, expect } from 'vitest';
import {
  createFollowUpCycle,
  recordSentDelivery,
  recordCapturedReply,
  createEmptyInCycleContext,
} from '../../../src/followups/cycle-state.js';
import { buildContinuationDraft } from '../../../src/followups/compose-proposal-drafts.js';
import type { FollowUpProposal } from '../../../src/contracts/follow-up-proposal.js';

const proposal: FollowUpProposal = {
  index: 1,
  issueKey: 'MTN-123',
  engineerDisplayName: 'Alex Chen',
  reasonType: 'progress-update',
  draftMessage: 'Hi Alex, could you share a brief update on MTN-123?',
  confidence: 'High',
  urgency: 'Medium',
  evidence: [{ source: 'deliveryRisk', issueKey: 'MTN-123', summary: 'stale' }],
  status: 'pending',
};

describe('in-cycle context', () => {
  it('tracks askedPairs on send', () => {
    let cycle = createFollowUpCycle({
      squadId: 'orion',
      managerThreadTs: '1',
      artifactPath: 'x',
      analyzedAt: new Date().toISOString(),
      possiblyStale: false,
      proposals: [proposal],
    });

    cycle = recordSentDelivery(
      cycle,
      {
        proposalIndex: 1,
        finalMessageText: proposal.draftMessage,
        deliveryStatus: 'sent',
        sentMessageTs: '100.0',
      },
      proposal,
    );

    expect(cycle.inCycleContext.askedPairs).toHaveLength(1);
    expect(cycle.inCycleContext.askedPairs[0]!.issueKey).toBe('MTN-123');
  });

  it('stores capturedReplies for continuation drafts', () => {
    let cycle = createFollowUpCycle({
      squadId: 'orion',
      managerThreadTs: '1',
      artifactPath: 'x',
      analyzedAt: new Date().toISOString(),
      possiblyStale: false,
      proposals: [proposal],
    });

    cycle = recordCapturedReply(
      cycle,
      'Alex Chen',
      'MTN-123',
      'waiting on API contract — no ETA',
    );

    const continuation = buildContinuationDraft(proposal, cycle.inCycleContext);
    expect(continuation.draftMessage).toContain('API contract');
    expect(continuation.draftMessage).not.toBe(proposal.draftMessage);
  });

  it('starts with empty context (no cross-cycle carryover)', () => {
    const ctx = createEmptyInCycleContext();
    expect(ctx.askedPairs).toEqual([]);
    expect(ctx.capturedReplies).toEqual([]);
  });
});
