import type { SquadConfig } from '../contracts/config.js';
import type { NormalizedSquadSnapshot } from '../contracts/normalized-squad-snapshot.js';
import { JiraClient, JiraAuthError, type JiraIssue, type JiraSprint } from './client.js';
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
      issues = await client.getBoardIssues(
        squad.kanbanBoardId,
        'statusCategory != Done OR resolved >= -30d',
        ISSUE_CAP,
      );
    } else {
      // Fallback: project JQL only
      const projectFilter = squad.projectKeys.map((k) => `"${k}"`).join(', ');
      const jql = `project in (${projectFilter}) ORDER BY updated DESC`;
      const result = await client.searchJql(jql, ISSUE_CAP);
      issues = result.issues;
    }

    // If board path returned nothing, try project JQL as a secondary signal
    if (issues.length === 0 && squad.projectKeys.length > 0) {
      const projectFilter = squad.projectKeys.map((k) => `"${k}"`).join(', ');
      let jql = `project in (${projectFilter})`;
      if (squad.scrumBoardId) {
        jql += ' AND sprint in openSprints()';
      }
      jql += ' ORDER BY updated DESC';
      try {
        const fallback = await client.searchJql(jql, ISSUE_CAP);
        if (fallback.issues.length > 0) {
          issues = fallback.issues;
          retrievalNotes.push(
            'Board agile path returned 0 issues; used project JQL fallback (open sprint when scrum).',
          );
        } else {
          retrievalNotes.push(
            `Search returned 0 issues for projects [${squad.projectKeys.join(', ')}]` +
              (squad.scrumBoardId ? ` and board ${squad.scrumBoardId}` : '') +
              '. Verify projectKeys and board IDs in config.',
          );
        }
      } catch (fallbackErr) {
        const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        retrievalNotes.push(`Project JQL fallback failed: ${msg}`);
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
        scrumScope: squad.scrumBoardId ? 'active+previous sprint via board API' : undefined,
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
          '0 issues in scope. Analysis is incomplete — do not treat as a healthy empty sprint without verifying Jira config (project keys, board ID, active sprint).',
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
    // Board may not exist or Agile API disabled — caller still has JQL fallback
    return {
      issues: [],
      note: `Could not load sprints for board ${boardId}: ${msg}`,
    };
  }

  const activeSprint = active[0]
    ? {
        id: String(active[0].id),
        name: active[0].name,
        startDate: active[0].startDate ?? new Date().toISOString(),
        endDate: active[0].endDate ?? new Date().toISOString(),
      }
    : undefined;

  // Most recently closed sprint by endDate
  const sortedClosed = [...closed].sort((a, b) => {
    const ae = a.endDate ? Date.parse(a.endDate) : 0;
    const be = b.endDate ? Date.parse(b.endDate) : 0;
    return be - ae;
  });
  const prev = sortedClosed[0];
  const previousSprint = prev
    ? {
        id: String(prev.id),
        name: prev.name,
        startDate: prev.startDate ?? new Date().toISOString(),
        endDate: prev.endDate ?? new Date().toISOString(),
      }
    : undefined;

  const issueMap = new Map<string, JiraIssue>();

  if (activeSprint) {
    const sprintIssues = await client.getSprintIssues(Number(activeSprint.id), ISSUE_CAP);
    for (const issue of sprintIssues) {
      issueMap.set(issue.key, issue);
    }
  }

  if (previousSprint && issueMap.size < ISSUE_CAP) {
    const prevIssues = await client.getSprintIssues(
      Number(previousSprint.id),
      ISSUE_CAP - issueMap.size,
    );
    for (const issue of prevIssues) {
      if (!issueMap.has(issue.key)) {
        issueMap.set(issue.key, issue);
      }
    }
  }

  // If no sprints at board, pull board backlog/open issues
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
