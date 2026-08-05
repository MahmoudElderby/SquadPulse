import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { formatGroupedDrafts, groupDraftsByRecipient } from '../../../src/report/group-drafts.js';
import type { FollowUpDraft } from '../../../src/contracts/contextual-analysis.js';

const sampleDrafts: FollowUpDraft[] = JSON.parse(
  readFileSync('fixtures/ai/sample-contextual-analysis.json', 'utf-8'),
).followUpDrafts;

describe('draft grouping', () => {
  it('groups drafts by recipient', () => {
    const grouped = groupDraftsByRecipient(sampleDrafts);
    expect(grouped.size).toBeGreaterThan(1);
    expect(grouped.has('Alex Chen')).toBe(true);
  });

  it('includes overflow line when exceeding cap', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      recipientDisplayName: `Person ${i % 3}`,
      issueKeys: [`KEY-${i}`],
      observation: 'Observation',
      request: 'Request',
      draftType: 'hygiene' as const,
    }));
    const formatted = formatGroupedDrafts(many, 10);
    expect(formatted).toContain('+2 more drafts not shown');
  });

  it('uses hygiene vs delivery wording labels', () => {
    const formatted = formatGroupedDrafts(sampleDrafts);
    expect(formatted).toContain('[delivery]');
    expect(formatted).toContain('[hygiene]');
    expect(formatted).toContain('[dependency]');
  });
});
