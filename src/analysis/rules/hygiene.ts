import type { NormalizedSquadSnapshot } from '../../contracts/normalized-squad-snapshot.js';
import type { HygieneFinding } from '../../contracts/deterministic-findings.js';

export function detectHygiene(snapshot: NormalizedSquadSnapshot): HygieneFinding[] {
  const findings: HygieneFinding[] = [];

  for (const item of snapshot.workItems) {
    if (item.statusCategory === 'done') continue;

    if (item.storyPoints == null && item.issueType !== 'Sub-task') {
      findings.push({
        issueKey: item.key,
        category: 'missingEstimate',
        evidence: `${item.key} has no story point estimate`,
        suggestedAction: 'Add estimate or confirm sizing in planning.',
      });
    }

    if (!item.assigneeDisplayName) {
      findings.push({
        issueKey: item.key,
        category: 'missingAssignee',
        evidence: `${item.key} has no assignee`,
        suggestedAction: 'Assign owner or mark as unplanned.',
      });
    }

    if (item.blockerMentionInComments && item.statusCategory !== 'blocked') {
      findings.push({
        issueKey: item.key,
        category: 'unstructuredBlockerMention',
        evidence: `${item.key} mentions blocker in comments but status is not Blocked`,
        suggestedAction: 'Update status or formalize blocker link.',
      });
    }

    if (item.resolution && item.statusCategory !== 'done') {
      findings.push({
        issueKey: item.key,
        category: 'completedStillOpen',
        evidence: `${item.key} has resolution "${item.resolution}" but is not Done`,
        suggestedAction: 'Transition to Done or clear resolution.',
      });
    }

    if ((item.daysSinceMeaningfulUpdate ?? 0) >= 7 && item.latestCommentExcerpt) {
      findings.push({
        issueKey: item.key,
        category: 'staleComments',
        evidence: `${item.key} has stale comment thread (${item.daysSinceMeaningfulUpdate} days)`,
        suggestedAction: 'Refresh context with a comment or status update.',
      });
    }
  }
  return findings;
}
