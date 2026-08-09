import { describe, it, expect } from 'vitest';
import { assignConfidence, assignUrgency } from '../../../src/followups/assign-confidence-urgency.js';

describe('assignConfidence / assignUrgency', () => {
  it('assigns High confidence for deterministic source', () => {
    expect(
      assignConfidence({
        reasonType: 'progress-update',
        priorityTier: 'P2',
        source: 'deterministic',
        hasCorroboratingDeterministic: false,
        isUnownedBlocker: false,
        isStaleOrBlocked: true,
      }),
    ).toBe('High');
  });

  it('assigns Medium confidence for contextual with corroboration', () => {
    expect(
      assignConfidence({
        reasonType: 'progress-update',
        priorityTier: 'P2',
        source: 'contextual',
        hasCorroboratingDeterministic: true,
        isUnownedBlocker: false,
        isStaleOrBlocked: false,
      }),
    ).toBe('Medium');
  });

  it('assigns High urgency for P0 unowned blocker', () => {
    expect(
      assignUrgency({
        reasonType: 'blocker-clarification',
        priorityTier: 'P0',
        source: 'deterministic',
        hasCorroboratingDeterministic: false,
        isUnownedBlocker: true,
        sprintElapsedFraction: 0.5,
        isStaleOrBlocked: true,
      }),
    ).toBe('High');
  });

  it('assigns Medium urgency for estimate-reminder', () => {
    expect(
      assignUrgency({
        reasonType: 'estimate-reminder',
        priorityTier: 'P2',
        source: 'deterministic',
        hasCorroboratingDeterministic: false,
        isUnownedBlocker: false,
        isStaleOrBlocked: false,
      }),
    ).toBe('Medium');
  });

  it('assigns Low urgency for routine hygiene late sprint', () => {
    expect(
      assignUrgency({
        reasonType: 'jira-status-reminder',
        priorityTier: 'P4',
        source: 'deterministic',
        hasCorroboratingDeterministic: false,
        isUnownedBlocker: false,
        sprintElapsedFraction: 0.3,
        isStaleOrBlocked: false,
      }),
    ).toBe('Low');
  });
});
