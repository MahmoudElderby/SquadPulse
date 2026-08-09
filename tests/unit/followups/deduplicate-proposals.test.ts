import { describe, it, expect } from 'vitest';
import { deduplicateAndCapProposals } from '../../../src/followups/deduplicate-proposals.js';
import type { FollowUpProposal } from '../../../src/contracts/follow-up-proposal.js';

function proposal(overrides: Partial<FollowUpProposal> & Pick<FollowUpProposal, 'index'>): FollowUpProposal {
  return {
    issueKey: 'MTN-1',
    engineerDisplayName: 'Alex Chen',
    reasonType: 'progress-update',
    draftMessage: 'Hi',
    confidence: 'Medium',
    urgency: 'Medium',
    evidence: [{ source: 'deliveryRisk', issueKey: 'MTN-1', summary: 'evidence' }],
    status: 'pending',
    ...overrides,
  };
}

describe('deduplicateAndCapProposals', () => {
  it('merges duplicate engineer+issue+reasonType keys', () => {
    const candidates = [
      proposal({ index: 1, evidence: [{ source: 'deliveryRisk', issueKey: 'MTN-1', summary: 'a' }] }),
      proposal({ index: 2, evidence: [{ source: 'deliveryRisk', issueKey: 'MTN-1', summary: 'b' }] }),
    ];
    const { proposals, mergedCount } = deduplicateAndCapProposals(candidates, 10);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.evidence).toHaveLength(2);
    expect(mergedCount).toBe(1);
  });

  it('caps at max and reports overflow', () => {
    const candidates = Array.from({ length: 12 }, (_, i) =>
      proposal({
        index: i + 1,
        issueKey: `MTN-${i + 1}`,
        urgency: i < 6 ? 'High' : 'Low',
      }),
    );
    const { proposals, overflowCount } = deduplicateAndCapProposals(candidates, 10);
    expect(proposals).toHaveLength(10);
    expect(overflowCount).toBe(2);
    expect(proposals[0]!.index).toBe(1);
  });

  it('sorts by urgency then confidence descending', () => {
    const candidates = [
      proposal({ index: 1, issueKey: 'A', urgency: 'Low', confidence: 'High' }),
      proposal({ index: 2, issueKey: 'B', urgency: 'High', confidence: 'Low' }),
      proposal({ index: 3, issueKey: 'C', urgency: 'Medium', confidence: 'Medium' }),
    ];
    const { proposals } = deduplicateAndCapProposals(candidates, 10);
    expect(proposals[0]!.issueKey).toBe('B');
  });
});
