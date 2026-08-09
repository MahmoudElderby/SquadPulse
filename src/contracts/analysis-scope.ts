import { z } from 'zod';

/**
 * Portable analysis scope — independent of transport (Slack, future Jira webhook/prompt).
 * Dimensions combine with AND when more than one is set.
 * Empty scope = full squad baseline.
 */
export const analysisScopeSchema = z.object({
  /** Explicit issue keys, e.g. MTN-11155 */
  issueKeys: z.array(z.string().min(1)).optional(),
  /**
   * Assignee display-name fragments (case-insensitive substring match).
   * Matched against workItem.assigneeDisplayName.
   */
  assignees: z.array(z.string().min(1)).optional(),
  /** Future: labels, components, priorities — reserved */
  labels: z.array(z.string().min(1)).optional(),
  /** Original phrases extracted (audit / report) */
  focusNotes: z.array(z.string()).optional(),
});

export type AnalysisScope = z.infer<typeof analysisScopeSchema>;

export function isScopeActive(scope: AnalysisScope | undefined): boolean {
  if (!scope) return false;
  return Boolean(
    (scope.issueKeys && scope.issueKeys.length > 0) ||
      (scope.assignees && scope.assignees.length > 0) ||
      (scope.labels && scope.labels.length > 0),
  );
}

export function formatScopeSummary(scope: AnalysisScope | undefined): string | null {
  if (!isScopeActive(scope) || !scope) return null;
  const parts: string[] = [];
  if (scope.issueKeys?.length) {
    parts.push(`tickets ${scope.issueKeys.map((k) => `\`${k}\``).join(', ')}`);
  }
  if (scope.assignees?.length) {
    parts.push(`assignee focus: ${scope.assignees.map((a) => `*${a}*`).join(', ')}`);
  }
  if (scope.labels?.length) {
    parts.push(`labels: ${scope.labels.join(', ')}`);
  }
  return parts.join(' · ');
}
