import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { detectCrossSquadPriorities } from '../../../src/analysis/cross-squad.js';
import { normalizedSquadSnapshotSchema } from '../../../src/contracts/normalized-squad-snapshot.js';

describe('cross-squad priorities', () => {
  it('detects linked issues across squads', () => {
    const storefront = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/storefront-sprint-active.json', 'utf-8')),
    );
    const payments = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/payments-mixed-boards.json', 'utf-8')),
    );
    const priorities = detectCrossSquadPriorities([storefront, payments]);
    expect(priorities.length).toBeGreaterThan(0);
    expect(priorities.some((p) => p.kind === 'linkedIssues' || p.kind === 'crossSquadBlockerOwner')).toBe(true);
  });

  it('orders priorities by impact score descending', () => {
    const storefront = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/storefront-sprint-active.json', 'utf-8')),
    );
    const payments = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/payments-mixed-boards.json', 'utf-8')),
    );
    const priorities = detectCrossSquadPriorities([storefront, payments]);
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i - 1].impactScore).toBeGreaterThanOrEqual(priorities[i].impactScore);
    }
  });
});
