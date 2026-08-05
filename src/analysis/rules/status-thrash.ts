import type { NormalizedSquadSnapshot } from '../../contracts/normalized-squad-snapshot.js';
import type { DeliveryRisk } from '../../contracts/deterministic-findings.js';

export function detectStatusThrash(snapshot: NormalizedSquadSnapshot): DeliveryRisk[] {
  const risks: DeliveryRisk[] = [];

  for (const item of snapshot.workItems) {
    if (item.wasInPreviousSprint && item.statusCategory === 'notStarted') {
      risks.push({
        category: 'statusThrash',
        issueKeys: [item.key],
        evidence: [`${item.key} carried from previous sprint back to not started`],
        impact: 'Issue may have been reopened or scope reset without clear resolution.',
        recommendedAction: `Clarify scope and status intent for ${item.key}.`,
        impactScore: 35,
      });
    }
  }
  return risks;
}
