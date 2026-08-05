import type { NormalizedSquadSnapshot } from '../../contracts/normalized-squad-snapshot.js';
import type { DeliveryRisk, Blocker } from '../../contracts/deterministic-findings.js';

export function detectUnownedBlocker(snapshot: NormalizedSquadSnapshot): {
  risks: DeliveryRisk[];
  blockers: Blocker[];
} {
  const risks: DeliveryRisk[] = [];
  const blockers: Blocker[] = [];

  for (const item of snapshot.workItems) {
    if (item.statusCategory !== 'blocked' && !item.isBlockedFlag) continue;

    const isOwned = Boolean(item.assigneeDisplayName);
    blockers.push({
      issueKey: item.key,
      blockedByKeys: item.linkedIssues?.map((l) => l.key) ?? [],
      dependencyOwner: item.assigneeDisplayName ?? null,
      isOwned,
    });

    if (!isOwned && (item.priorityTier === 'P0' || item.priorityTier === 'P1')) {
      risks.push({
        category: 'unownedBlocker',
        issueKeys: [item.key],
        evidence: [`${item.key} is blocked (${item.priorityTier}) with no assignee`],
        impact: 'Critical blocked work has no owner to drive resolution.',
        recommendedAction: `Assign an owner to ${item.key} and identify blocker resolution path.`,
        impactScore: item.priorityTier === 'P0' ? 100 : 80,
      });
    }
  }
  return { risks, blockers };
}
