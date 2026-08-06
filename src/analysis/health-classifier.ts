import type { DeliveryRisk } from '../contracts/deterministic-findings.js';
import type { NormalizedSquadSnapshot } from '../contracts/normalized-squad-snapshot.js';

export interface HealthClassification {
  status: 'On Track' | 'Needs Attention' | 'At Risk';
  reasons: string[];
  deliveryRiskCount: number;
}

export function classifyHealth(
  deliveryRisks: DeliveryRisk[],
  snapshot: NormalizedSquadSnapshot,
): HealthClassification {
  const count = deliveryRisks.length;
  const reasons: string[] = [];

  // Empty or failed retrieval must not read as a healthy sprint (Constitution IX)
  if (snapshot.workItems.length === 0) {
    const fetchFailed = (snapshot.limitations ?? []).some((l) =>
      /failed|error|could not/i.test(l.reason),
    );
    reasons.push(
      fetchFailed
        ? 'Jira data could not be retrieved (or retrieval failed); status is unknown'
        : '0 issues retrieved in scope — verify board ID, project keys, and active sprint before treating as healthy',
    );
    return {
      status: 'Needs Attention',
      reasons,
      deliveryRiskCount: count,
    };
  }

  const hasUnownedP01Blocker = deliveryRisks.some(
    (r) => r.category === 'unownedBlocker' && r.issueKeys.length > 0,
  );
  const hasUnassignedCritical = deliveryRisks.some((r) => r.category === 'unassignedCritical');
  const elapsed = snapshot.activeSprint?.elapsedFraction ?? 0;
  const lateCritical =
    hasUnassignedCritical && elapsed >= 0.5;

  if (count >= 3 || hasUnownedP01Blocker || lateCritical) {
    if (count >= 3) reasons.push(`${count} delivery risks identified`);
    if (hasUnownedP01Blocker) reasons.push('Unowned P0/P1 blocker present');
    if (lateCritical) reasons.push('Unassigned P0/P1-tier sprint work after 50% sprint elapsed');
    return { status: 'At Risk', reasons: reasons.length ? reasons : ['Multiple delivery risks'], deliveryRiskCount: count };
  }

  if (count >= 1) {
    reasons.push(`${count} delivery risk${count > 1 ? 's' : ''} require attention`);
    return { status: 'Needs Attention', reasons, deliveryRiskCount: count };
  }

  return { status: 'On Track', reasons: [], deliveryRiskCount: 0 };
}
