import type { SquadConfig } from '../contracts/config.js';
import type { NormalizedSquadSnapshot } from '../contracts/normalized-squad-snapshot.js';
import { JiraClient, JiraAuthError, type JiraIssue, type JiraSprint } from './client.js';
import { normalizeIssues } from './normalize.js';

const ISSUE_CAP = 500;

export interface FetchSquadResult {
  snapshot: NormalizedSquadSnapshot;
  error?: string;
}

/** Strip trailing ORDER BY so we can append sprint / updated clauses. */
export function normalizeBoardFilterJql(raw: string): string {
  return raw.replace(/\s+ORDER\s+BY\s+.+$/i, '').trim();
}

/**
 * Build squad scope JQL.
 * Prefer boardFilterJql (exact board settings); else project keys.
 */
export function buildSquadScopeJql(squad: SquadConfig, extraClauses: string[] = []): string {
  const base = squad.boardFilterJql
    ? normalizeBoardFilterJql(squad.boardFilterJql)
    : `project in (${squad.projectKeys.map((k) => `"${k}"`).join(', ')})`;

  const parts = [base, ...extraClauses.filter(Boolean)];
  return `${parts.join(' AND ')} ORDER BY updated DESC`;
}

export async function fetchSquadSnapshot(
  client: JiraClient,
  squad: SquadConfig,
  timezone: string,
  allSquadIds: string[],
): Promise<FetchSquadResult> {
  try {
    let issues: JiraIssue[] = [];
    let activeSprintMeta: NormalizedSquadSnapshot['activeSprint'];
    let previousSprintMeta: NormalizedSquadSnapshot['previousSprint'];
    const retrievalNotes: string[] = [];

    if (squad.scrumBoardId) {
      const boardResult = await fetchScrumBoardIssues(client, squad.scrumBoardId);
      issues = boardResult.issues;
      activeSprintMeta = boardResult.activeSprint;
      previousSprintMeta = boardResult.previousSprint;
      if (boardResult.note) retrievalNotes.push(boardResult.note);
    } else if (squad.kanbanBoardId) {
      const filter = squad.boardFilterJql
        ? normalizeBoardFilterJql(squad.boardFilterJql)
        : 'statusCategory != Done OR resolved >= -30d';
      issues = await client.getBoardIssues(squad.kanbanBoardId, filter, ISSUE_CAP);
    } else {
      const jql = buildSquadScopeJql(squad);
      const result = await client.searchJql(jql, ISSUE_CAP);
      issues = result.issues;
    }

    // Prefer boardFilterJql-based search when board path is empty or only project keys would be wrong
    if (issues.length === 0 || squad.boardFilterJql) {
      try {
        const extras: string[] = [];
        if (squad.scrumBoardId && activeSprintMeta) {
          extras.push(`sprint = ${activeSprintMeta.id}`);
        } else if (squad.scrumBoardId) {
          extras.push('sprint in openSprints()');
        }
        const jql = buildSquadScopeJql(squad, extras);
        const scoped = await client.searchJql(jql, ISSUE_CAP);
        if (scoped.issues.length > 0) {
          // Prefer filter-scoped results when configured (board filter is source of truth)
          if (squad.boardFilterJql || issues.length === 0) {
            if (issues.length > 0 && scoped.issues.length !== issues.length) {
              retrievalNotes.push(
                `Applied boardFilterJql (${scoped.issues.length} issues) instead of board agile list (${issues.length}).`,
              );
            } else if (issues.length === 0) {
              retrievalNotes.push(
                `Board agile path returned 0 issues; loaded ${scoped.issues.length} via boardFilterJql / project JQL.`,
              );
            }
            issues = scoped.issues;
          }
        } else if (issues.length === 0) {
          retrievalNotes.push(
            `Search returned 0 issues for JQL derived from ` +
              (squad.boardFilterJql ? 'boardFilterJql' : `projects [${squad.projectKeys.join(', ')}]`) +
              (squad.scrumBoardId ? ` and board ${squad.scrumBoardId}` : '') +
              '. Verify boardFilterJql, projectKeys, board ID, and active sprint.',
          );
        }
      } catch (fallbackErr) {
        const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        if (issues.length === 0) {
          retrievalNotes.push(`Scoped JQL search failed: ${msg}`);
        }
      }
    }

    const truncated = issues.length >= ISSUE_CAP;

    const snapshot = normalizeIssues({
      squad,
      issues,
      timezone,
      allSquadIds,
      activeSprint: activeSprintMeta,
      previousSprint: previousSprintMeta,
      retrievalMeta: {
        issueCount: issues.length,
        cap: 500 as const,
        truncated,
        scrumScope: squad.scrumBoardId ? 'active+previous sprint via board/filter' : undefined,
        kanbanScope: squad.kanbanBoardId && !squad.scrumBoardId ? 'open+30d closed' : undefined,
      },
    });

    const limitations: NonNullable<NormalizedSquadSnapshot['limitations']> = [
      ...(snapshot.limitations ?? []),
    ];

    for (const note of retrievalNotes) {
      limitations.push({
        scope: `${squad.displayName} / issue retrieval`,
        reason: note,
      });
    }

    if (issues.length === 0) {
      limitations.push({
        scope: `${squad.displayName} / issue retrieval`,
        reason:
          '0 issues in scope. Analysis is incomplete — do not treat as a healthy empty sprint without verifying Jira config (project keys, boardFilterJql, board ID, active sprint).',
      });
    }

    if (truncated) {
      limitations.push({
        scope: `${squad.displayName} / issue retrieval`,
        reason: `Retrieved ${ISSUE_CAP} issues (cap); analysis may be incomplete.`,
      });
    }

    snapshot.limitations = limitations.length ? limitations : undefined;

    return { snapshot };
  } catch (err) {
    if (err instanceof JiraAuthError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    return {
      snapshot: emptySnapshot(squad, timezone, message),
      error: message,
    };
  }
}

async function fetchScrumBoardIssues(
  client: JiraClient,
  boardId: number,
): Promise<{
  issues: JiraIssue[];
  activeSprint?: NormalizedSquadSnapshot['activeSprint'];
  previousSprint?: NormalizedSquadSnapshot['previousSprint'];
  note?: string;
}> {
  let active: JiraSprint[] = [];
  let closed: JiraSprint[] = [];

  try {
    active = await client.getBoardSprints(boardId, 'active');
    closed = await client.getBoardSprints(boardId, 'closed');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      issues: [],
      note: `Could not load sprints for board ${boardId}: ${msg}`,
    };
  }

  const activeSprint = active[0]
    ? {
        id: active[0].id,
        name: active[0].name,
        state: 'active' as const,
        startDate: active[0].startDate ?? new Date().toISOString(),
        endDate: active[0].endDate ?? new Date().toISOString(),
      }
    : undefined;

  const sortedClosed = [...closed].sort((a, b) => {
    const ae = a.endDate ? Date.parse(a.endDate) : 0;
    const be = b.endDate ? Date.parse(b.endDate) : 0;
    return be - ae;
  });
  const prev = sortedClosed[0];
  const previousSprint = prev
    ? {
        id: prev.id,
        name: prev.name,
        state: 'closed' as const,
        startDate: prev.startDate ?? new Date().toISOString(),
        endDate: prev.endDate ?? new Date().toISOString(),
      }
    : undefined;

  const issueMap = new Map<string, JiraIssue>();

  if (activeSprint) {
    const sprintIssues = await client.getSprintIssues(activeSprint.id, ISSUE_CAP);
    for (const issue of sprintIssues) {
      issueMap.set(issue.key, issue);
    }
  }

  if (previousSprint && issueMap.size < ISSUE_CAP) {
    const prevIssues = await client.getSprintIssues(
      previousSprint.id,
      ISSUE_CAP - issueMap.size,
    );
    for (const issue of prevIssues) {
      if (!issueMap.has(issue.key)) {
        issueMap.set(issue.key, issue);
      }
    }
  }

  if (issueMap.size === 0) {
    const boardIssues = await client.getBoardIssues(boardId, undefined, ISSUE_CAP);
    for (const issue of boardIssues) {
      issueMap.set(issue.key, issue);
    }
    return {
      issues: [...issueMap.values()],
      activeSprint,
      previousSprint,
      note: activeSprint
        ? undefined
        : `Board ${boardId} has no active sprint; used current board issue list.`,
    };
  }

  return {
    issues: [...issueMap.values()],
    activeSprint,
    previousSprint,
  };
}

function emptySnapshot(
  squad: SquadConfig,
  timezone: string,
  errorMessage: string,
): NormalizedSquadSnapshot {
  return {
    squadId: squad.id,
    displayName: squad.displayName,
    generatedAt: new Date().toISOString(),
    timezone,
    workItems: [],
    retrievalMeta: { issueCount: 0, cap: 500, truncated: false },
    limitations: [
      {
        scope: `${squad.displayName} / issue retrieval`,
        reason: `Jira fetch failed: ${errorMessage}`,
      },
    ],
  };
}
