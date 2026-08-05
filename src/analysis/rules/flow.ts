import type { SquadConfig } from '../../contracts/config.js';
import type { NormalizedSquadSnapshot } from '../../contracts/normalized-squad-snapshot.js';
import type { FlowSignal } from '../../contracts/deterministic-findings.js';

export function detectFlowSignals(
  snapshot: NormalizedSquadSnapshot,
  squad: SquadConfig,
): FlowSignal[] {
  const signals: FlowSignal[] = [];
  const maxWip = squad.thresholds?.maxInProgressPerPerson ?? 3;

  const inProgressByPerson = new Map<string, string[]>();
  for (const item of snapshot.workItems) {
    if (item.statusCategory !== 'inProgress') continue;
    const person = item.assigneeDisplayName ?? 'Unassigned';
    const keys = inProgressByPerson.get(person) ?? [];
    keys.push(item.key);
    inProgressByPerson.set(person, keys);
  }

  for (const [person, keys] of inProgressByPerson) {
    if (keys.length > maxWip) {
      signals.push({
        signalType: 'wipOverload',
        description: `${person} has ${keys.length} items in progress (team threshold: ${maxWip}). This may indicate context switching rather than individual capacity.`,
        relatedIssueKeys: keys,
      });
    }
  }

  const reviewItems = snapshot.workItems.filter((w) => w.statusCategory === 'reviewOrHandoff');
  if (reviewItems.length >= 5) {
    signals.push({
      signalType: 'reviewBottleneck',
      description: `${reviewItems.length} items in review/handoff may indicate a flow bottleneck.`,
      relatedIssueKeys: reviewItems.map((w) => w.key),
    });
  }

  const unownedUrgent = snapshot.workItems.filter(
    (w) =>
      !w.assigneeDisplayName &&
      (w.priorityTier === 'P0' || w.priorityTier === 'P1') &&
      w.statusCategory !== 'done',
  );
  if (unownedUrgent.length >= 2) {
    signals.push({
      signalType: 'unownedUrgentQueue',
      description: `${unownedUrgent.length} unassigned P0/P1 items in the queue.`,
      relatedIssueKeys: unownedUrgent.map((w) => w.key),
    });
  }

  const externalDeps = snapshot.workItems.filter((w) =>
    w.linkedIssues?.some((l) => l.otherSquadId),
  );
  if (externalDeps.length >= 3) {
    signals.push({
      signalType: 'externalDependencyCluster',
      description: `${externalDeps.length} items have cross-squad dependencies.`,
      relatedIssueKeys: externalDeps.map((w) => w.key),
    });
  }

  return signals;
}
