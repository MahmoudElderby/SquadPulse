import { withRetry } from '../lib/retry.js';
import type { ResolvedSecrets } from '../config/secrets.js';

export class JiraAuthError extends Error {
  readonly status = 401;
  readonly code = 'JIRA_AUTH_FAILED';

  constructor(message = 'Jira authentication failed') {
    super(message);
    this.name = 'JiraAuthError';
  }
}

const DEFAULT_FIELDS = [
  'summary',
  'status',
  'priority',
  'assignee',
  'created',
  'updated',
  'issuetype',
  'parent',
  'labels',
  'components',
  'resolution',
  'comment',
  'customfield_10016',
];

export class JiraClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private authFailed = false;

  constructor(secrets: ResolvedSecrets) {
    this.baseUrl = secrets.jiraBaseUrl.replace(/\/$/, '');
    const encoded = Buffer.from(`${secrets.jiraEmail}:${secrets.jiraApiToken}`).toString('base64');
    this.authHeader = `Basic ${encoded}`;
  }

  get isAuthFailed(): boolean {
    return this.authFailed;
  }

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (this.authFailed) {
      throw new JiraAuthError();
    }

    return withRetry(async () => {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          Authorization: this.authHeader,
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
          ...init?.headers,
        },
      });

      if (response.status === 401 || response.status === 403) {
        this.authFailed = true;
        throw new JiraAuthError(`Jira returned ${response.status}`);
      }

      if (!response.ok) {
        let detail = '';
        try {
          detail = await response.text();
        } catch {
          /* ignore */
        }
        const err = new Error(
          `Jira API error: ${response.status} ${response.statusText}${detail ? ` — ${detail.slice(0, 300)}` : ''}`,
        ) as Error & { status: number };
        err.status = response.status;
        throw err;
      }

      if (response.status === 204) {
        return {} as T;
      }

      return (await response.json()) as T;
    });
  }

  /**
   * Enhanced JQL search (POST /rest/api/3/search/jql).
   * Legacy GET /rest/api/3/search was removed from Jira Cloud.
   */
  async searchJql(jql: string, maxResults = 500): Promise<JiraSearchResult> {
    const issues: JiraIssue[] = [];
    let nextPageToken: string | undefined;

    while (issues.length < maxResults) {
      const pageSize = Math.min(100, maxResults - issues.length);
      const body: Record<string, unknown> = {
        jql,
        maxResults: pageSize,
        fields: DEFAULT_FIELDS,
      };
      if (nextPageToken) {
        body.nextPageToken = nextPageToken;
      }

      const page = await this.request<JiraEnhancedSearchResult>('/rest/api/3/search/jql', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const batch = page.issues ?? [];
      issues.push(...batch);

      if (page.isLast !== false || !page.nextPageToken || batch.length === 0) {
        break;
      }
      nextPageToken = page.nextPageToken;
    }

    return {
      total: issues.length,
      maxResults,
      startAt: 0,
      issues: issues.slice(0, maxResults),
    };
  }

  async getBoardSprints(
    boardId: number,
    state: 'active' | 'closed' | 'future' = 'active',
  ): Promise<JiraSprint[]> {
    const params = new URLSearchParams({
      state,
      maxResults: state === 'closed' ? '5' : '50',
    });
    const data = await this.request<JiraSprintListResponse>(
      `/rest/agile/1.0/board/${boardId}/sprint?${params}`,
    );
    return data.values ?? [];
  }

  async getSprintIssues(sprintId: number, maxResults = 500): Promise<JiraIssue[]> {
    const issues: JiraIssue[] = [];
    let startAt = 0;

    while (issues.length < maxResults) {
      const pageSize = Math.min(50, maxResults - issues.length);
      const params = new URLSearchParams({
        startAt: String(startAt),
        maxResults: String(pageSize),
        fields: DEFAULT_FIELDS.join(','),
      });
      const page = await this.request<JiraAgileIssuePage>(
        `/rest/agile/1.0/sprint/${sprintId}/issue?${params}`,
      );
      const batch = page.issues ?? [];
      issues.push(...batch);
      if (batch.length === 0 || startAt + batch.length >= (page.total ?? 0)) {
        break;
      }
      startAt += batch.length;
    }

    return issues.slice(0, maxResults);
  }

  async getBoardIssues(boardId: number, jqlExtra?: string, maxResults = 500): Promise<JiraIssue[]> {
    const issues: JiraIssue[] = [];
    let startAt = 0;

    while (issues.length < maxResults) {
      const pageSize = Math.min(50, maxResults - issues.length);
      const params = new URLSearchParams({
        startAt: String(startAt),
        maxResults: String(pageSize),
        fields: DEFAULT_FIELDS.join(','),
      });
      if (jqlExtra) {
        params.set('jql', jqlExtra);
      }
      const page = await this.request<JiraAgileIssuePage>(
        `/rest/agile/1.0/board/${boardId}/issue?${params}`,
      );
      const batch = page.issues ?? [];
      issues.push(...batch);
      if (batch.length === 0 || startAt + batch.length >= (page.total ?? 0)) {
        break;
      }
      startAt += batch.length;
    }

    return issues.slice(0, maxResults);
  }
}

// Fix reference bug - `page` out of scope at return
// I'll fix in the file - total should be issues.length when enhanced API doesn't return total
// Let me rewrite searchJql carefully in the write above - I had a bug with `page` after loop.

export interface JiraSearchResult {
  total: number;
  maxResults: number;
  startAt: number;
  issues: JiraIssue[];
}

interface JiraEnhancedSearchResult {
  issues?: JiraIssue[];
  nextPageToken?: string;
  isLast?: boolean;
  total?: number;
}

interface JiraSprintListResponse {
  values?: JiraSprint[];
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
  originBoardId?: number;
}

interface JiraAgileIssuePage {
  issues?: JiraIssue[];
  startAt?: number;
  maxResults?: number;
  total?: number;
}

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    priority?: { name: string };
    assignee?: { displayName: string; accountId: string } | null;
    created: string;
    updated: string;
    issuetype: { name: string; subtask?: boolean };
    parent?: { key: string };
    labels?: string[];
    components?: { name: string }[];
    resolution?: { name: string } | null;
    comment?: { comments: { body: unknown; created: string }[] };
    customfield_10016?: number | null;
  };
}
