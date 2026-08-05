import type { NormalizedSquadSnapshot } from '../contracts/normalized-squad-snapshot.js';
import type { CrossSquadPriority } from '../contracts/daily-briefing.js';

export function detectCrossSquadPriorities(
  snapshots: NormalizedSquadSnapshot[],
): CrossSquadPriority[] {
  const priorities: CrossSquadPriority[] = [];
  if (snapshots.length < 2) return priorities;

  const squadIds = snapshots.map((s) => s.squadId);
  const linkedPairs = new Map<string, { keys: string[]; squads: [string, string] }>();

  for (const snapshot of snapshots) {
    for (const item of snapshot.workItems) {
      for (const link of item.linkedIssues ?? []) {
        if (!link.otherSquadId || !squadIds.includes(link.otherSquadId)) continue;
        const pairKey = [snapshot.squadId, link.otherSquadId].sort().join(':');
        const existing = linkedPairs.get(pairKey) ?? {
          keys: [],
          squads: [snapshot.squadId, link.otherSquadId] as [string, string],
        };
        existing.keys.push(item.key, link.key);
        linkedPairs.set(pairKey, existing);
      }

      if (item.statusCategory === 'blocked' && item.linkedIssues?.length) {
        for (const link of item.linkedIssues) {
          if (link.otherSquadId) {
            priorities.push({
              kind: 'crossSquadBlockerOwner',
              issueKeys: [item.key, link.key],
              squads: [snapshot.squadId, link.otherSquadId],
              impactScore: 80,
              summary: `${item.key} blocked with cross-squad dependency on ${link.key}`,
            });
          }
        }
      }

      if (item.parentKey && item.issueType?.toLowerCase().includes('epic')) {
        const parentSquad = snapshots.find((s) =>
          s.workItems.some((w) => w.key === item.parentKey),
        );
        if (parentSquad && parentSquad.squadId !== snapshot.squadId) {
          priorities.push({
            kind: 'sharedEpic',
            issueKeys: [item.key, item.parentKey],
            squads: [snapshot.squadId, parentSquad.squadId],
            impactScore: 60,
            summary: `Shared epic linkage between ${item.key} and ${item.parentKey}`,
          });
        }
      }
    }
  }

  for (const [, data] of linkedPairs) {
    const uniqueKeys = [...new Set(data.keys)];
    priorities.push({
      kind: 'linkedIssues',
      issueKeys: uniqueKeys,
      squads: data.squads,
      impactScore: 50 + uniqueKeys.length * 5,
      summary: `Cross-squad linked issues: ${uniqueKeys.slice(0, 3).join(', ')}${uniqueKeys.length > 3 ? '...' : ''}`,
    });
  }

  return priorities.sort((a, b) => b.impactScore - a.impactScore);
}

export type { CrossSquadPriority };
