import type { SquadConfig } from '../contracts/config.js';
import type { NormalizedSquadSnapshot } from '../contracts/normalized-squad-snapshot.js';
import { JiraClient, JiraAuthError } from './client.js';
import { normalizeIssues } from './normalize.js';

const ISSUE_CAP = 500;

export interface FetchSquadResult {
  snapshot: NormalizedSquadSnapshot;
  error?: string;
}

export async function fetchSquadSnapshot(
  client: JiraClient,
  squad: SquadConfig,
  timezone: string,
  allSquadIds: string[],
): Promise<FetchSquadResult> {
  try {
    const projectFilter = squad.projectKeys.map((k) => `"${k}"`).join(', ');
    const jqlParts: string[] = [`project in (${projectFilter})`];

    if (squad.scrumBoardId) {
      jqlParts.push('(sprint in openSprints() OR sprint in closedSprints())');
    }
    if (squad.kanbanBoardId && !squad.scrumBoardId) {
      jqlParts.push('(status != Done OR resolutiondate >= -30d)');
    }

    const jql = jqlParts.join(' AND ') + ' ORDER BY updated DESC';
    const result = await client.searchJql(jql, ISSUE_CAP);
    const truncated = result.total > ISSUE_CAP;

    const snapshot = normalizeIssues({
      squad,
      issues: result.issues,
      timezone,
      allSquadIds,
      retrievalMeta: {
        issueCount: Math.min(result.total, ISSUE_CAP),
        cap: 500 as const,
        truncated,
        scrumScope: squad.scrumBoardId ? 'active+previous sprint' : undefined,
        kanbanScope: squad.kanbanBoardId ? 'open+30d closed' : undefined,
      },
    });

    if (truncated) {
      snapshot.limitations = [
        ...(snapshot.limitations ?? []),
        {
          scope: `${squad.displayName} / issue retrieval`,
          reason: `Retrieved ${ISSUE_CAP} of ${result.total} issues; analysis may be incomplete.`,
        },
      ];
    }

    return { snapshot };
  } catch (err) {
    if (err instanceof JiraAuthError) throw err;
    return {
      snapshot: emptySnapshot(squad, timezone),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function emptySnapshot(squad: SquadConfig, timezone: string): NormalizedSquadSnapshot {
  return {
    squadId: squad.id,
    displayName: squad.displayName,
    generatedAt: new Date().toISOString(),
    timezone,
    workItems: [],
    retrievalMeta: { issueCount: 0, cap: 500, truncated: false },
  };
}
