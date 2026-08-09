import { describe, it, expect } from 'vitest';
import { classifyReplyText, summarizeReplies } from '../../../src/followups/summarize-replies.js';
import type { FollowUpProposal } from '../../../src/contracts/follow-up-proposal.js';
import type { ApprovedMessageDelivery } from '../../../src/contracts/follow-up-cycle.js';

describe('summarizeReplies', () => {
  it('flags blocker phrases as manager attention recommended', () => {
    const result = classifyReplyText('Still blocked waiting on API contract');
    expect(result.recommendation).toBe('manager attention recommended');
    expect(result.blockerSignal).toBeDefined();
  });

  it('recognizes ETA patterns as no further follow-up needed', () => {
    const result = classifyReplyText('Should be done by Friday EOD');
    expect(result.recommendation).toBe('no further follow-up needed');
  });

  it('handles emoji-only as ambiguous', () => {
    const result = classifyReplyText('👍');
    expect(result.extraction).toBe('no on-topic content extracted');
    expect(result.recommendation).toBe('another follow-up suggested (draft on request)');
  });

  it('handles not started replies', () => {
    const result = classifyReplyText("Haven't started on this yet");
    expect(result.recommendation).toBe('another follow-up suggested (draft on request)');
  });

  it('marks no reply when delivery has no messages', () => {
    const proposals: FollowUpProposal[] = [
      {
        index: 1,
        issueKey: 'MTN-1',
        engineerDisplayName: 'Alex',
        reasonType: 'progress-update',
        draftMessage: 'Hi',
        confidence: 'High',
        urgency: 'Medium',
        evidence: [{ source: 'deliveryRisk', issueKey: 'MTN-1', summary: 'x' }],
        status: 'sent',
      },
    ];
    const deliveries: ApprovedMessageDelivery[] = [
      { proposalIndex: 1, finalMessageText: 'Hi', deliveryStatus: 'sent', sentMessageTs: '1.0' },
    ];
    const results = summarizeReplies(proposals, deliveries, new Map());
    expect(results[0]!.readStatus).toBe('no reply yet within cycle window');
  });
});
