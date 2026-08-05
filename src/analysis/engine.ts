import type { SquadConfig } from '../contracts/config.js';
import type { NormalizedSquadSnapshot } from '../contracts/normalized-squad-snapshot.js';
import type { DeterministicFindings, DeliveryRisk } from '../contracts/deterministic-findings.js';
import { classifyHealth } from './health-classifier.js';
import { detectStaleInProgress } from './rules/stale-in-progress.js';
import { detectNoRecentUpdate } from './rules/no-recent-update.js';
import { detectUnownedBlocker } from './rules/unowned-blocker.js';
import { detectUnassignedCritical } from './rules/unassigned-critical.js';
import { detectLateStart } from './rules/late-start.js';
import { detectCrossSquadDependency } from './rules/cross-squad-dependency.js';
import { detectSubtaskInconsistency } from './rules/subtask-inconsistency.js';
import { detectStatusThrash } from './rules/status-thrash.js';
import { detectUnplannedScope } from './rules/unplanned-scope.js';
import { detectHygiene } from './rules/hygiene.js';
import { detectFlowSignals } from './rules/flow.js';

function dedupeRisks(risks: DeliveryRisk[]): DeliveryRisk[] {
  const seen = new Set<string>();
  return risks.filter((r) => {
    const key = `${r.category}:${r.issueKeys.sort().join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildKeyFacts(snapshot: NormalizedSquadSnapshot): string[] {
  const facts: string[] = [];
  const total = snapshot.workItems.length;
  const inProgress = snapshot.workItems.filter((w) => w.statusCategory === 'inProgress').length;
  const blocked = snapshot.workItems.filter((w) => w.statusCategory === 'blocked').length;

  facts.push(`${total} issues in scope`);
  facts.push(`${inProgress} in progress, ${blocked} blocked`);

  if (snapshot.activeSprint) {
    facts.push(`Active sprint: ${snapshot.activeSprint.name}`);
    if (snapshot.activeSprint.elapsedFraction != null) {
      facts.push(`Sprint ${Math.round(snapshot.activeSprint.elapsedFraction * 100)}% elapsed`);
    }
  } else if (snapshot.workItems.some((w) => w.boardType === 'kanban')) {
    facts.push('Kanban board: open items + 30-day closed window');
  }

  if (snapshot.retrievalMeta.truncated) {
    facts.push(`Data truncated at ${snapshot.retrievalMeta.cap} issues`);
  }

  return facts;
}

function buildManagerActions(risks: DeliveryRisk[]): DeterministicFindings['managerActions'] {
  return risks
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 5)
    .map((r, i) => ({
      priority: i + 1,
      action: r.recommendedAction,
      relatedIssueKeys: r.issueKeys,
    }));
}

export function analyzeSnapshot(
  snapshot: NormalizedSquadSnapshot,
  squad: SquadConfig,
): DeterministicFindings {
  const blockerResult = detectUnownedBlocker(snapshot);

  const allRisks = dedupeRisks([
    ...detectStaleInProgress(snapshot, squad),
    ...detectNoRecentUpdate(snapshot, squad),
    ...blockerResult.risks,
    ...detectUnassignedCritical(snapshot),
    ...detectLateStart(snapshot),
    ...detectCrossSquadDependency(snapshot),
    ...detectSubtaskInconsistency(snapshot),
    ...detectStatusThrash(snapshot),
    ...detectUnplannedScope(snapshot),
  ]);

  const health = classifyHealth(allRisks, snapshot);
  const hygieneFindings = detectHygiene(snapshot);
  const flowSignals = detectFlowSignals(snapshot, squad);

  return {
    squadId: snapshot.squadId,
    health,
    keyFacts: buildKeyFacts(snapshot),
    deliveryRisks: allRisks.sort((a, b) => b.impactScore - a.impactScore),
    blockers: blockerResult.blockers,
    hygieneFindings,
    flowSignals,
    managerActions: buildManagerActions(allRisks),
    limitations: snapshot.limitations,
  };
}
