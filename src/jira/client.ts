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
          ...init?.headers,
        },
      });

      if (response.status === 401 || response.status === 403) {
        this.authFailed = true;
        throw new JiraAuthError(`Jira returned ${response.status}`);
      }

      if (!response.ok) {
        const err = new Error(`Jira API error: ${response.status} ${response.statusText}`) as Error & {
          status: number;
        };
        err.status = response.status;
        throw err;
      }

      return (await response.json()) as T;
    });
  }

  async searchJql(jql: string, maxResults = 500, startAt = 0): Promise<JiraSearchResult> {
    const params = new URLSearchParams({
      jql,
      maxResults: String(maxResults),
      startAt: String(startAt),
      fields: 'summary,status,priority,assignee,created,updated,issuetype,parent,labels,components,resolution,comment',
    });
    return this.request<JiraSearchResult>(`/rest/api/3/search?${params}`);
  }
}

export interface JiraSearchResult {
  total: number;
  maxResults: number;
  startAt: number;
  issues: JiraIssue[];
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
