import { describe, it, expect } from 'vitest';
import { mergeRisksByTicket, buildManagerActionsFromRisks } from '../../../src/analysis/merge-by-ticket.js';
import type { DeliveryRisk } from '../../../src/contracts/deterministic-findings.js';

function risk(
  partial: Partial<DeliveryRisk> & Pick<DeliveryRisk, 'category' | 'issueKeys'>,
): DeliveryRisk {
  return {
    evidence: [`${partial.issueKeys[0]} evidence`],
    impact: 'impact',
    recommendedAction: `Action for ${partial.issueKeys[0]} (${partial.category})`,
    impactScore: 50,
    ...partial,
  };
}

describe('mergeRisksByTicket', () => {
  it('collapses stale + noRecentUpdate on the same key to one card', () => {
    const merged = mergeRisksByTicket([
      risk({
        category: 'staleInProgress',
        issueKeys: ['MTN-11500'],
        impactScore: 50,
        impact: 'stuck without progress',
        recommendedAction: 'Check with assignee on MTN-11500',
      }),
      risk({
        category: 'noRecentUpdate',
        issueKeys: ['MTN-11500'],
        impactScore: 40,
        impact: 'lack recent context',
        recommendedAction: 'Request a status update on MTN-11500',
      }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].issueKeys).toEqual(['MTN-11500']);
    expect(merged[0].evidence).toHaveLength(2);
    expect(merged[0].evidence.some((e) => /Stale in progress/i.test(e))).toBe(true);
    expect(merged[0].evidence.some((e) => /No recent update/i.test(e))).toBe(true);
    // Prefer noRecentUpdate action for clearer manager ask
    expect(merged[0].recommendedAction).toMatch(/status update/i);
  });

  it('keeps different tickets separate', () => {
    const merged = mergeRisksByTicket([
      risk({ category: 'staleInProgress', issueKeys: ['MTN-1'], impactScore: 10 }),
      risk({ category: 'noRecentUpdate', issueKeys: ['MTN-2'], impactScore: 20 }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it('builds one manager action per merged risk', () => {
    const merged = mergeRisksByTicket([
      risk({ category: 'staleInProgress', issueKeys: ['MTN-1'], impactScore: 10 }),
      risk({ category: 'noRecentUpdate', issueKeys: ['MTN-1'], impactScore: 20 }),
      risk({ category: 'staleInProgress', issueKeys: ['MTN-2'], impactScore: 30 }),
    ]);
    const actions = buildManagerActionsFromRisks(merged);
    expect(actions).toHaveLength(2);
    expect(actions.map((a) => a.relatedIssueKeys[0]).sort()).toEqual(['MTN-1', 'MTN-2']);
  });
});
