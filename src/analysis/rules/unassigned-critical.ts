import type { NormalizedSquadSnapshot } from '../../contracts/normalized-squad-snapshot.js';
import type { DeliveryRisk } from '../../contracts/deterministic-findings.js';

export function detectUnassignedCritical(snapshot: NormalizedSquadSnapshot): DeliveryRisk[] {
  const risks: DeliveryRisk[] = [];
  const activeSprintId = snapshot.activeSprint?.id;
  const elapsed = snapshot.activeSprint?.elapsedFraction ?? 0;

  for (const item of snapshot.workItems) {
    if (item.assigneeDisplayName) continue;
    if (item.priorityTier !== 'P0' && item.priorityTier !== 'P1') continue;
    if (item.statusCategory === 'done') continue;

    const inActiveSprint =
      activeSprintId && item.sprintIds?.includes(activeSprintId);
    if (!inActiveSprint && snapshot.activeSprint) continue;

    if (elapsed >= 0.5 || !snapshot.activeSprint) {
      risks.push({
        category: 'unassignedCritical',
        issueKeys: [item.key],
        evidence: [
          `${item.key} is ${item.priorityTier}-tier, unassigned${inActiveSprint ? ', in active sprint' : ''}`,
        ],
        impact: 'Critical sprint work lacks an owner.',
        recommendedAction: `Assign ${item.key} before sprint commitment slips.`,
        impactScore: item.priorityTier === 'P0' ? 90 : 70,
      });
    }
  }
  return risks;
}
