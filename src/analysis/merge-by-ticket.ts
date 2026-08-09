import type { DeliveryRisk, ManagerAction } from '../contracts/deterministic-findings.js';

const RISK_LABELS: Record<DeliveryRisk['category'], string> = {
  staleInProgress: 'Stale in progress',
  noRecentUpdate: 'No recent update',
  unownedBlocker: 'Unowned blocker',
  unassignedCritical: 'Unassigned critical work',
  lateStart: 'Late start on sprint work',
  crossSquadDependency: 'Cross-squad dependency',
  subtaskInconsistency: 'Parent/subtask mismatch',
  statusThrash: 'Status thrashing',
  unplannedScope: 'Unplanned scope risk',
};

/** Preference for which rule “owns” the single manager ask on a ticket */
const ACTION_CATEGORY_PRIORITY: DeliveryRisk['category'][] = [
  'unownedBlocker',
  'unassignedCritical',
  'noRecentUpdate',
  'staleInProgress',
  'lateStart',
  'crossSquadDependency',
  'statusThrash',
  'unplannedScope',
  'subtaskInconsistency',
];

/**
 * Collapse multiple delivery-risk *types* that target the same ticket into one risk card.
 * Health / action counts then reflect issues needing attention, not rule-stack height.
 */
export function mergeRisksByTicket(risks: DeliveryRisk[]): DeliveryRisk[] {
  const groups = new Map<string, DeliveryRisk[]>();

  for (const risk of risks) {
    const groupKey = ticketGroupKey(risk.issueKeys);
    const list = groups.get(groupKey) ?? [];
    list.push(risk);
    groups.set(groupKey, list);
  }

  const merged: DeliveryRisk[] = [];
  for (const [, group] of groups) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }

    const byImpact = [...group].sort((a, b) => b.impactScore - a.impactScore);
    const primary = byImpact[0];
    const actionSource = pickActionSource(group);
    const issueKeys = unique(group.flatMap((r) => r.issueKeys));

    // One evidence line per rule type for the report “Why” bullets
    const evidence = byImpact.map(
      (r) => `${RISK_LABELS[r.category] ?? r.category} — ${r.impact}`,
    );

    merged.push({
      category: primary.category,
      issueKeys,
      evidence,
      impact: byImpact.map((r) => r.impact).join(' '),
      recommendedAction: actionSource.recommendedAction,
      impactScore: Math.max(...group.map((r) => r.impactScore)),
    });
  }

  return merged.sort((a, b) => b.impactScore - a.impactScore);
}

/**
 * One manager action per ticket, using the merged risk’s preferred ask.
 */
export function buildManagerActionsFromRisks(risks: DeliveryRisk[]): ManagerAction[] {
  return risks.slice(0, 5).map((r, i) => ({
    priority: i + 1,
    action: r.recommendedAction,
    relatedIssueKeys: r.issueKeys,
  }));
}

function ticketGroupKey(keys: string[]): string {
  if (!keys.length) return '__empty__';
  return [...keys].map((k) => k.toUpperCase()).sort().join('+');
}

function pickActionSource(group: DeliveryRisk[]): DeliveryRisk {
  for (const cat of ACTION_CATEGORY_PRIORITY) {
    const match = group.find((r) => r.category === cat);
    if (match) return match;
  }
  return [...group].sort((a, b) => b.impactScore - a.impactScore)[0];
}

function unique_str(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function unique<T extends string>(values: T[]): T[] {
  return unique_str(values) as T[];
}

export function riskCategoryLabel(category: DeliveryRisk['category']): string {
  return RISK_LABELS[category] ?? category;
}
