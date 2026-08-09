import type { SquadAnalysisArtifact } from '../contracts/squad-analysis-artifact.js';
import type { FollowUpReasonType } from '../contracts/follow-up-proposal.js';

type PriorityTier = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
type Level = 'Low' | 'Medium' | 'High';

export interface ConfidenceUrgencyInput {
  reasonType: FollowUpReasonType;
  priorityTier: PriorityTier;
  source: 'deterministic' | 'contextual';
  hasCorroboratingDeterministic: boolean;
  isUnownedBlocker: boolean;
  sprintElapsedFraction?: number;
  isStaleOrBlocked: boolean;
}

export function assignConfidence(input: ConfidenceUrgencyInput): Level {
  if (input.source === 'deterministic') {
    return 'High';
  }
  if (input.hasCorroboratingDeterministic) {
    return 'Medium';
  }
  return 'Low';
}

export function assignUrgency(input: ConfidenceUrgencyInput): Level {
  const { priorityTier, isUnownedBlocker, sprintElapsedFraction = 0, isStaleOrBlocked } = input;

  if (isUnownedBlocker && (priorityTier === 'P0' || priorityTier === 'P1')) {
    return 'High';
  }

  if (sprintElapsedFraction >= 0.8 && isStaleOrBlocked && (priorityTier === 'P0' || priorityTier === 'P1')) {
    return 'High';
  }

  if (
    input.reasonType === 'estimate-reminder' ||
    (input.reasonType === 'progress-update' && (priorityTier === 'P2' || priorityTier === 'P3'))
  ) {
    return 'Medium';
  }

  if (
    input.reasonType === 'jira-status-reminder' &&
    (sprintElapsedFraction <= 0.5 || priorityTier === 'P4' || priorityTier === 'P3')
  ) {
    return 'Low';
  }

  if (input.reasonType === 'jira-status-reminder') {
    return 'Medium';
  }

  if (sprintElapsedFraction > 0.5 && input.reasonType === 'sprint-risk-clarification') {
    return 'Medium';
  }

  return 'Low';
}

export function getSprintElapsedFraction(artifact: SquadAnalysisArtifact): number | undefined {
  const active = artifact.snapshot.sprints?.find((s) => s.state === 'active');
  if (!active?.startDate || !active?.endDate) return undefined;
  const start = new Date(active.startDate).getTime();
  const end = new Date(active.endDate).getTime();
  const now = Date.now();
  if (end <= start) return undefined;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

export function getWorkItemPriority(
  artifact: SquadAnalysisArtifact,
  issueKey: string,
): PriorityTier {
  const item = artifact.snapshot.workItems.find((w) => w.key === issueKey);
  return item?.priorityTier ?? 'P3';
}

export function getAssignee(
  artifact: SquadAnalysisArtifact,
  issueKey: string,
): string | null {
  const item = artifact.snapshot.workItems.find((w) => w.key === issueKey);
  return item?.assigneeDisplayName ?? null;
}
