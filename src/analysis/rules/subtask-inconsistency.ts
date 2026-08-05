import type { NormalizedSquadSnapshot } from '../../contracts/normalized-squad-snapshot.js';
import type { DeliveryRisk } from '../../contracts/deterministic-findings.js';

export function detectSubtaskInconsistency(snapshot: NormalizedSquadSnapshot): DeliveryRisk[] {
  const risks: DeliveryRisk[] = [];
  const itemsByKey = new Map(snapshot.workItems.map((w) => [w.key, w]));

  for (const item of snapshot.workItems) {
    if (!item.subtaskKeys?.length) continue;
    const openSubtasks = item.subtaskKeys.filter((k) => {
      const sub = itemsByKey.get(k);
      return sub && sub.statusCategory !== 'done';
    });
    if (item.statusCategory === 'done' && openSubtasks.length > 0) {
      risks.push({
        category: 'subtaskInconsistency',
        issueKeys: [item.key, ...openSubtasks],
        evidence: [`${item.key} marked done but subtasks ${openSubtasks.join(', ')} remain open`],
        impact: 'Parent/child status mismatch may hide incomplete work.',
        recommendedAction: `Reconcile subtask status for ${item.key}.`,
        impactScore: 40,
      });
    }
  }
  return risks;
}
