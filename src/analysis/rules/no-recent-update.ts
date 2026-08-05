import type { SquadConfig } from '../../contracts/config.js';
import type { NormalizedSquadSnapshot } from '../../contracts/normalized-squad-snapshot.js';
import type { DeliveryRisk } from '../../contracts/deterministic-findings.js';

export function detectNoRecentUpdate(
  snapshot: NormalizedSquadSnapshot,
  squad: SquadConfig,
): DeliveryRisk[] {
  const threshold = squad.thresholds?.noMeaningfulUpdateBusinessDays ?? 3;
  const risks: DeliveryRisk[] = [];

  for (const item of snapshot.workItems) {
    if (item.statusCategory === 'done') continue;
    const days = item.daysSinceMeaningfulUpdate ?? 0;
    if (days >= threshold) {
      risks.push({
        category: 'noRecentUpdate',
        issueKeys: [item.key],
        evidence: [`${item.key} last updated ${days} days ago (threshold: ${threshold})`],
        impact: 'Issue may lack recent context or progress updates.',
        recommendedAction: `Request a status update on ${item.key}.`,
        impactScore: days * 8,
      });
    }
  }
  return risks;
}
