import { describe, expect, it } from 'vitest';
import { renderCyclePreview, renderCommandHelp } from '../../../src/followups/render-cycle-preview.js';
import type { FollowUpCycle } from '../../../src/contracts/follow-up-cycle.js';

const baseCycle: FollowUpCycle = {
  cycleId: 'test-cycle',
  squadId: 'orion',
  status: 'awaitingApproval',
  startedAt: '2026-08-09T12:00:00Z',
  analysisConsumed: {
    squadId: 'orion',
    analyzedAt: '2026-08-09T11:00:00Z',
    possiblyStale: false,
    sourceRunId: 'run-1',
  },
  proposals: [
    {
      index: 1,
      issueKey: 'ORI-1',
      engineerDisplayName: 'Alex',
      engineerSlackUserId: 'U1',
      reasonType: 'progress-update',
      draftMessage: 'Quick progress check?',
      confidence: 'Medium',
      urgency: 'Low',
      evidence: [{ summary: 'In progress 6 days' }],
      status: 'pending',
    },
    {
      index: 2,
      issueKey: 'ORI-2',
      engineerDisplayName: 'Sam',
      engineerSlackUserId: 'U2',
      reasonType: 'blocker-clarification',
      draftMessage: 'Any blockers on this?',
      confidence: 'High',
      urgency: 'Medium',
      evidence: [{ summary: 'Blocked 3 days' }],
      status: 'pending',
    },
  ],
};

describe('renderCyclePreview', () => {
  it('shows step-by-step reply guide with concrete proposal numbers', () => {
    const output = renderCyclePreview(baseCycle);

    expect(output).toContain('*How to respond*');
    expect(output).toContain('Reply in this thread with plain text');
    expect(output).toContain('`approve 1`');
    expect(output).toContain('`approve 1, 2`');
    expect(output).toContain('`approve all`');
    expect(output).toContain('`edit 1:');
    expect(output).toContain('`status`');
    expect(output).toContain('`done`');
    expect(output).not.toContain('approve <n>');
  });

  it('shows close guidance when there are no proposals', () => {
    const output = renderCyclePreview({ ...baseCycle, proposals: [] });

    expect(output).toContain('No follow-up proposals generated');
    expect(output).toContain('`done`');
  });
});

describe('renderCommandHelp', () => {
  it('includes concrete examples', () => {
    const output = renderCommandHelp();

    expect(output).toContain('`approve 1`');
    expect(output).toContain('`edit 1:');
  });
});
