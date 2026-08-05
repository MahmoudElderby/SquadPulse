import type { SquadConfig } from '../../contracts/config.js';
import type { NormalizedSquadSnapshot } from '../../contracts/normalized-squad-snapshot.js';
import type { DeliveryRisk } from '../../contracts/deterministic-findings.js';

export function detectStaleInProgress(
  snapshot: NormalizedSquadSnapshot,
  squad: SquadConfig,
): DeliveryRisk[] {
  const threshold = squad.thresholds?.staleInProgressBusinessDays ?? 5;
  const risks: DeliveryRisk[] = [];

  for (const item of snapshot.workItems) {
    if (item.statusCategory !== 'inProgress') continue;
    const age = item.ageInCurrentStatusBusinessDays ?? 0;
    if (age >= threshold) {
      risks.push({
        category: 'staleInProgress',
        issueKeys: [item.key],
        evidence: [`${item.key} has been In Progress for ${age} business days (threshold: ${threshold})`],
        impact: 'Work may be stuck without progress visibility.',
        recommendedAction: `Check with assignee on ${item.key} status and blockers.`,
        impactScore: age * 10,
      });
    }
  }
  return risks;
}
