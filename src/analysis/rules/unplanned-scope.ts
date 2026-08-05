import type { NormalizedSquadSnapshot } from '../../contracts/normalized-squad-snapshot.js';
import type { DeliveryRisk } from '../../contracts/deterministic-findings.js';

export function detectUnplannedScope(snapshot: NormalizedSquadSnapshot): DeliveryRisk[] {
  const risks: DeliveryRisk[] = [];

  for (const item of snapshot.workItems) {
    if (item.addedAfterSprintStart === true) {
      risks.push({
        category: 'unplannedScope',
        issueKeys: [item.key],
        evidence: [`${item.key} added after sprint start`],
        impact: 'Unplanned scope may affect sprint commitment.',
        recommendedAction: `Review scope trade-offs for ${item.key}.`,
        impactScore: 30,
      });
    }
  }
  return risks;
}
