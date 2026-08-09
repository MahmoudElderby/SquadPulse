import type { EmCopilotConfig } from '../contracts/config.js';
import type { SquadAnalysisArtifact } from '../contracts/squad-analysis-artifact.js';
import type { FollowUpProposal, EvidenceRef, FollowUpReasonType } from '../contracts/follow-up-proposal.js';
import {
  assignConfidence,
  assignUrgency,
  getAssignee,
  getSprintElapsedFraction,
  getWorkItemPriority,
} from './assign-confidence-urgency.js';
import { deduplicateAndCapProposals } from './deduplicate-proposals.js';
import { resolveCommunicationAssistant } from '../contracts/config.js';

export interface MapFindingsResult {
  proposals: FollowUpProposal[];
  overflowCount: number;
  skipped: { issueKey: string; reason: string }[];
  dataLimitations: { scope: string; reason: string }[];
}

interface CandidateDraft {
  issueKey: string;
  engineerDisplayName: string;
  reasonType: FollowUpReasonType;
  evidence: EvidenceRef[];
  source: 'deterministic' | 'contextual';
  isUnownedBlocker: boolean;
  isStaleOrBlocked: boolean;
}

function resolveSlackUserId(
  config: EmCopilotConfig,
  squadId: string,
  engineerDisplayName: string,
): string | undefined {
  const squad = config.squads.find((s) => s.id === squadId);
  return squad?.teamMemberSlackMap?.[engineerDisplayName];
}

function scaffoldDraftMessage(
  engineer: string,
  issueKey: string,
  reasonType: FollowUpReasonType,
): string {
  const templates: Record<FollowUpReasonType, string> = {
    'progress-update': `Hi ${engineer}, could you share a brief update on ${issueKey}?`,
    'blocker-clarification': `Hi ${engineer}, could you clarify the blocker status on ${issueKey}?`,
    'estimate-reminder': `Hi ${engineer}, when you have a moment, could you add a story point estimate to ${issueKey}?`,
    'jira-status-reminder': `Hi ${engineer}, could you review whether the Jira status on ${issueKey} reflects current progress?`,
    'dependency-follow-up': `Hi ${engineer}, could you share an update on the dependency affecting ${issueKey}?`,
    'sprint-risk-clarification': `Hi ${engineer}, could you help clarify sprint risk on ${issueKey}?`,
  };
  return templates[reasonType];
}

export function mapFindingsToProposals(
  artifact: SquadAnalysisArtifact,
  config: EmCopilotConfig,
): MapFindingsResult {
  const ca = resolveCommunicationAssistant(config);
  const findings = artifact.deterministicFindings;
  const sprintElapsed = getSprintElapsedFraction(artifact);
  const candidates: CandidateDraft[] = [];
  const skipped: { issueKey: string; reason: string }[] = [];
  const dataLimitations: { scope: string; reason: string }[] = [];

  for (const risk of findings.deliveryRisks) {
    const issueKey = risk.issueKeys[0]!;
    let reasonType: FollowUpReasonType | null = null;

    if (risk.category === 'staleInProgress' || risk.category === 'noRecentUpdate') {
      reasonType = 'progress-update';
    } else if (risk.category === 'crossSquadDependency') {
      reasonType = 'dependency-follow-up';
    } else if (
      (risk.category === 'lateStart' || risk.category === 'unplannedScope') &&
      (findings.health.status === 'At Risk' || findings.health.status === 'Needs Attention')
    ) {
      reasonType = 'sprint-risk-clarification';
    } else {
      skipped.push({ issueKey, reason: `unmapped delivery risk category: ${risk.category}` });
      continue;
    }

    const assignee = getAssignee(artifact, issueKey);
    if (!assignee) {
      skipped.push({ issueKey, reason: 'missing assignee' });
      dataLimitations.push({ scope: issueKey, reason: 'skipped: missing assignee' });
      continue;
    }

    candidates.push({
      issueKey,
      engineerDisplayName: assignee,
      reasonType,
      evidence: [{ source: 'deliveryRisk', issueKey, summary: risk.evidence[0] ?? risk.impact }],
      source: 'deterministic',
      isUnownedBlocker: false,
      isStaleOrBlocked: risk.category === 'staleInProgress' || risk.category === 'noRecentUpdate',
    });
  }

  for (const blocker of findings.blockers) {
    const issueKey = blocker.issueKey;
    const isUnowned = blocker.isOwned === false || !blocker.dependencyOwner;
    if (!isUnowned && blocker.isOwned !== false) {
      continue;
    }

    const engineer =
      blocker.dependencyOwner ?? getAssignee(artifact, issueKey);
    if (!engineer) {
      skipped.push({ issueKey, reason: 'unowned blocker without recipient' });
      dataLimitations.push({ scope: issueKey, reason: 'skipped: unowned blocker without recipient' });
      continue;
    }

    candidates.push({
      issueKey,
      engineerDisplayName: engineer,
      reasonType: 'blocker-clarification',
      evidence: [
        {
          source: 'blocker',
          issueKey,
          summary: `Blocker on ${issueKey}${blocker.blockedByKeys?.length ? ` (blocked by ${blocker.blockedByKeys.join(', ')})` : ''}`,
        },
      ],
      source: 'deterministic',
      isUnownedBlocker: true,
      isStaleOrBlocked: true,
    });
  }

  for (const hygiene of findings.hygieneFindings) {
    const issueKey = hygiene.issueKey;
    let reasonType: FollowUpReasonType | null = null;

    if (hygiene.category === 'missingEstimate') {
      reasonType = 'estimate-reminder';
    } else if (hygiene.category === 'statusInconsistency' || hygiene.category === 'completedStillOpen') {
      reasonType = 'jira-status-reminder';
    } else {
      skipped.push({ issueKey, reason: `unmapped hygiene category: ${hygiene.category}` });
      continue;
    }

    const assignee = getAssignee(artifact, issueKey);
    if (!assignee) {
      skipped.push({ issueKey, reason: 'missing assignee' });
      continue;
    }

    candidates.push({
      issueKey,
      engineerDisplayName: assignee,
      reasonType,
      evidence: [{ source: 'hygieneFinding', issueKey, summary: hygiene.evidence }],
      source: 'deterministic',
      isUnownedBlocker: false,
      isStaleOrBlocked: false,
    });
  }

  for (const signal of findings.flowSignals) {
    const keys = signal.relatedIssueKeys ?? [];
    for (const issueKey of keys) {
      skipped.push({ issueKey, reason: `flow signal not mapped: ${signal.signalType}` });
    }
  }

  const rawProposals: FollowUpProposal[] = candidates.map((c, i) => {
    const priorityTier = getWorkItemPriority(artifact, c.issueKey);
    const confidence = assignConfidence({
      reasonType: c.reasonType,
      priorityTier,
      source: c.source,
      hasCorroboratingDeterministic: false,
      isUnownedBlocker: c.isUnownedBlocker,
      sprintElapsedFraction: sprintElapsed,
      isStaleOrBlocked: c.isStaleOrBlocked,
    });
    const urgency = assignUrgency({
      reasonType: c.reasonType,
      priorityTier,
      source: c.source,
      hasCorroboratingDeterministic: false,
      isUnownedBlocker: c.isUnownedBlocker,
      sprintElapsedFraction: sprintElapsed,
      isStaleOrBlocked: c.isStaleOrBlocked,
    });

    return {
      index: i + 1,
      issueKey: c.issueKey,
      engineerDisplayName: c.engineerDisplayName,
      slackUserId: resolveSlackUserId(config, artifact.squadId, c.engineerDisplayName),
      reasonType: c.reasonType,
      draftMessage: scaffoldDraftMessage(c.engineerDisplayName, c.issueKey, c.reasonType),
      confidence,
      urgency,
      evidence: c.evidence,
      status: 'pending' as const,
    };
  });

  const { proposals, overflowCount } = deduplicateAndCapProposals(rawProposals, ca.maxProposalsPerCycle);

  if (overflowCount > 0) {
    dataLimitations.push({
      scope: `${artifact.squadDisplayName} follow-ups`,
      reason: `${overflowCount} additional candidate(s) omitted (cap ${ca.maxProposalsPerCycle})`,
    });
  }

  if (artifact.limitations) {
    dataLimitations.push(...artifact.limitations);
  }

  return { proposals, overflowCount, skipped, dataLimitations };
}
