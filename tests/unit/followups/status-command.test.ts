import { describe, it, expect } from 'vitest';
import { createFollowUpCycle } from '../../../src/followups/cycle-state.js';
import { processManagerCommand } from '../../../src/followups/process-manager-command.js';
import type { FollowUpProposal } from '../../../src/contracts/follow-up-proposal.js';

const baseProposal: FollowUpProposal = {
  index: 1,
  issueKey: 'MTN-1',
  engineerDisplayName: 'Alex',
  reasonType: 'progress-update',
  draftMessage: 'Hi',
  confidence: 'High',
  urgency: 'Medium',
  evidence: [{ source: 'deliveryRisk', issueKey: 'MTN-1', summary: 'evidence' }],
  status: 'pending',
};

function makeCycle(proposals: FollowUpProposal[] = [baseProposal]) {
  return createFollowUpCycle({
    squadId: 'orion',
    managerThreadTs: '123',
    artifactPath: '/tmp/x.json',
    analyzedAt: new Date().toISOString(),
    possiblyStale: false,
    proposals,
  });
}

describe('status command handling', () => {
  it('sets shouldStatus on status command', () => {
    const result = processManagerCommand(makeCycle(), { kind: 'status' });
    expect(result.ok).toBe(true);
    expect(result.shouldStatus).toBe(true);
  });

  it('rejects unknown proposal index on approve', () => {
    const result = processManagerCommand(makeCycle(), {
      kind: 'approve',
      proposalIndexes: [99],
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Unknown proposal index');
  });

  it('closes cycle on done', () => {
    const result = processManagerCommand(makeCycle(), { kind: 'closeCycle' });
    expect(result.shouldClose).toBe(true);
    expect(result.cycle.status).toBe('closing');
  });
});
