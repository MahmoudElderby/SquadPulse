import type { NormalizedSquadSnapshot } from '../../contracts/normalized-squad-snapshot.js';
import type { DeliveryRisk } from '../../contracts/deterministic-findings.js';

export function detectLateStart(snapshot: NormalizedSquadSnapshot): DeliveryRisk[] {
  const risks: DeliveryRisk[] = [];
  const elapsed = snapshot.activeSprint?.elapsedFraction ?? 0;
  if (elapsed < 0.5 || !snapshot.activeSprint) return risks;

  for (const item of snapshot.workItems) {
    if (item.statusCategory !== 'notStarted') continue;
    if (item.priorityTier === 'P0' || item.priorityTier === 'P1') {
      risks.push({
        category: 'lateStart',
        issueKeys: [item.key],
        evidence: [
          `${item.key} (${item.priorityTier}) still not started at ${Math.round(elapsed * 100)}% sprint elapsed`,
        ],
        impact: 'High-priority work has not started mid-sprint.',
        recommendedAction: `Confirm start plan for ${item.key} or descope if needed.`,
        impactScore: 60,
      });
    }
  }
  return risks;
}
