import type { NormalizedSquadSnapshot, WorkItem } from '../contracts/normalized-squad-snapshot.js';
import type {
  DeliveryRisk,
  HygieneFinding,
  FlowSignal,
  ManagerAction,
  Blocker,
} from '../contracts/deterministic-findings.js';

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

const HYGIENE_LABELS: Record<HygieneFinding['category'], string> = {
  missingEstimate: 'no estimate',
  missingAssignee: 'unassigned',
  unclearAcceptanceCriteria: 'unclear acceptance criteria',
  statusInconsistency: 'status inconsistency',
  unstructuredBlockerMention: 'blocker mentioned but not formalized',
  completedStillOpen: 'resolved but still open',
  staleComments: 'stale comments',
};

export function indexWorkItems(snapshot: NormalizedSquadSnapshot): Map<string, WorkItem> {
  return new Map(snapshot.workItems.map((w) => [w.key, w]));
}

export function riskLabel(category: DeliveryRisk['category']): string {
  return RISK_LABELS[category] ?? category;
}

export function hygieneLabel(category: HygieneFinding['category']): string {
  return HYGIENE_LABELS[category] ?? category;
}

export function issueTitle(item: WorkItem | undefined, key: string): string {
  const summary = item?.summary?.trim();
  return summary ? summary : '(no summary in Jira)';
}

export function ownerLine(item: WorkItem | undefined): string {
  return item?.assigneeDisplayName?.trim() || 'Unassigned';
}

export function statusLine(item: WorkItem | undefined): string {
  return item?.statusName?.trim() || 'Unknown status';
}

export function lastUpdateLine(item: WorkItem | undefined): string | null {
  if (item?.daysSinceMeaningfulUpdate == null) return null;
  const d = item.daysSinceMeaningfulUpdate;
  if (d === 0) return 'Updated today';
  if (d === 1) return 'Last meaningful update: 1 day ago';
  return `Last meaningful update: ${d} days ago`;
}

/** `MTN-11155` — Checkout payment timeout */
export function keyTitleLine(key: string, map: Map<string, WorkItem>): string {
  return `\`${key}\` — ${issueTitle(map.get(key), key)}`;
}

export function formatRiskBlock(risk: DeliveryRisk, map: Map<string, WorkItem>, index: number): string[] {
  const key = risk.issueKeys[0];
  const item = map.get(key);
  const lines: string[] = [];
  lines.push(`${index}. ${keyTitleLine(key, map)}`);

  const meta: string[] = [
    `Owner: ${ownerLine(item)}`,
    `Status: ${statusLine(item)}`,
  ];
  const update = lastUpdateLine(item);
  if (update) meta.push(update);
  if (item?.priorityTier === 'P0' || item?.priorityTier === 'P1') {
    meta.push(`Priority: ${item.priorityTier}`);
  }
  lines.push(`   ${meta.join(' · ')}`);
  lines.push(`   Why: ${riskLabel(risk.category)} — ${risk.impact}`);
  lines.push(`   You: ${humanizeAction(risk.recommendedAction, item, key)}`);
  return lines;
}

export function formatBlockerLine(b: Blocker, map: Map<string, WorkItem>, index: number): string[] {
  const item = map.get(b.issueKey);
  const ownership = b.isOwned ? 'owned' : 'unowned';
  const lines: string[] = [];
  lines.push(`${index}. ${keyTitleLine(b.issueKey, map)}`);
  const meta = [
    `Owner: ${ownerLine(item)}`,
    `Status: ${statusLine(item)}`,
    ownership === 'owned' ? 'Owner known' : 'No owner',
  ];
  if (b.blockedByKeys?.length) {
    meta.push(`Depends on: ${b.blockedByKeys.map((k) => `\`${k}\``).join(', ')}`);
  }
  if (b.dependencyOwner) {
    meta.push(`Dependency owner: ${b.dependencyOwner}`);
  }
  lines.push(`   ${meta.join(' · ')}`);
  return lines;
}

/** Group hygiene findings by issue → one line with title + tags. */
export function formatMergedHygiene(
  findings: HygieneFinding[],
  map: Map<string, WorkItem>,
  cap = 5,
): { lines: string[]; overflow: number; issueCount: number } {
  const byKey = new Map<string, HygieneFinding[]>();
  for (const h of findings) {
    const list = byKey.get(h.issueKey) ?? [];
    list.push(h);
    byKey.set(h.issueKey, list);
  }

  const keys = [...byKey.keys()];
  const shown = keys.slice(0, cap);
  const lines = shown.map((key) => {
    const tags = (byKey.get(key) ?? []).map((h) => hygieneLabel(h.category));
    const unique = [...new Set(tags)];
    return `• ${keyTitleLine(key, map)} — ${unique.join(', ')}`;
  });

  return {
    lines,
    overflow: Math.max(0, keys.length - cap),
    issueCount: keys.length,
  };
}

export function formatFlowLine(signal: FlowSignal, map: Map<string, WorkItem>): string {
  const keys = signal.relatedIssueKeys ?? [];
  if (!keys.length) {
    return `• ${signal.description}`;
  }
  const details = keys
    .slice(0, 5)
    .map((k) => {
      const item = map.get(k);
      return `\`${k}\` ${issueTitle(item, k)}${item?.assigneeDisplayName ? '' : ' (unassigned)'}`;
    })
    .join('; ');
  const more = keys.length > 5 ? ` (+${keys.length - 5} more)` : '';
  return `• ${signal.description}\n  ${details}${more}`;
}

export function formatActionLine(
  action: ManagerAction,
  map: Map<string, WorkItem>,
): string {
  const key = action.relatedIssueKeys[0];
  if (!key) return `${action.priority}. ${action.action}`;
  const item = map.get(key);
  const owner = ownerLine(item);
  const title = issueTitle(item, key);
  const ask =
    owner === 'Unassigned'
      ? `Assign an owner for \`${key}\` — ${title}`
      : `Ask *${owner}* about \`${key}\` — ${title}`;
  // Prefer person-first phrasing; keep rule action as clue for "why"
  return `${action.priority}. ${ask}\n   (${riskHintFromAction(action.action)})`;
}

function humanizeAction(action: string, item: WorkItem | undefined, key: string): string {
  const owner = ownerLine(item);
  if (/status update/i.test(action)) {
    if (owner === 'Unassigned') {
      return `Assign an owner and request status, blockers, and expected completion for \`${key}\``;
    }
    return `Ask *${owner}* for status, any blocker, and expected completion date`;
  }
  if (/assign/i.test(action) && owner === 'Unassigned') {
    return `Assign an owner to drive \`${key}\``;
  }
  return action.replace(key, `\`${key}\``);
}

function riskHintFromAction(action: string): string {
  if (/status update/i.test(action)) return 'needs status update';
  if (/assign/i.test(action)) return 'needs owner';
  if (/blocker|escalat/i.test(action)) return 'blocker / dependency';
  return action.length > 60 ? `${action.slice(0, 57)}…` : action;
}

/** Drop redundant filter-vs-agile notes when boardFilterJql is intentional source of truth. */
export function cleanLimitations(
  limitations: { scope: string; reason: string }[] | undefined,
): { scope: string; reason: string }[] {
  if (!limitations?.length) return [];
  return limitations.filter(
    (l) =>
      !/Applied boardFilterJql/i.test(l.reason) &&
      !/instead of board agile list/i.test(l.reason),
  );
}
