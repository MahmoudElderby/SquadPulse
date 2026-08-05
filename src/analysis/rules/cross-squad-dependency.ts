import type { NormalizedSquadSnapshot } from '../../contracts/normalized-squad-snapshot.js';
import type { DeliveryRisk } from '../../contracts/deterministic-findings.js';

export function detectCrossSquadDependency(snapshot: NormalizedSquadSnapshot): DeliveryRisk[] {
  const risks: DeliveryRisk[] = [];

  for (const item of snapshot.workItems) {
    const crossLinks = item.linkedIssues?.filter((l) => l.otherSquadId) ?? [];
    if (crossLinks.length === 0) continue;

    risks.push({
      category: 'crossSquadDependency',
      issueKeys: [item.key, ...crossLinks.map((l) => l.key)],
      evidence: crossLinks.map(
        (l) => `${item.key} linked to ${l.key} (${l.linkType}) across squad boundary`,
      ),
      impact: 'Cross-squad dependency may delay delivery.',
      recommendedAction: `Coordinate with the other squad on linked issues for ${item.key}.`,
      impactScore: 50 + crossLinks.length * 10,
    });
  }
  return risks;
}
