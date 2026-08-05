import { describe, it, expect, vi } from 'vitest';
import { JiraClient, JiraAuthError } from '../../src/jira/client.js';
import { postSlackMessage } from '../../src/slack/post-message.js';
import { buildRunResult } from '../../src/lib/run-result.js';

describe('failure paths', () => {
  it('Jira auth failure produces JIRA_AUTH_FAILED RunResult code', async () => {
    const secrets = {
      jiraBaseUrl: 'https://example.atlassian.net',
      jiraEmail: 'bad@example.com',
      jiraApiToken: 'invalid-token',
      slackBotToken: '',
    };

    const client = new JiraClient(secrets);
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({}),
    });

    await expect(client.searchJql('project = TEST')).rejects.toThrow(JiraAuthError);
    expect(client.isAuthFailed).toBe(true);

    const result = buildRunResult({
      status: 'error',
      workflow: 'on-demand',
      slackDelivered: false,
      failureReason: 'JIRA_AUTH_FAILED',
    });
    expect(result.failureReason).toBe('JIRA_AUTH_FAILED');
    expect(result.status).toBe('error');
  });

  it('Slack post failure produces SLACK_POST_FAILED RunResult code', async () => {
    vi.mock('@slack/web-api', () => ({
      WebClient: class {
        chat = {
          postMessage: vi.fn().mockRejectedValue(new Error('invalid_auth')),
        };
      },
    }));

    const secrets = {
      jiraBaseUrl: 'https://example.atlassian.net',
      jiraEmail: 'user@example.com',
      jiraApiToken: 'token',
      slackBotToken: 'xoxb-invalid',
    };

    await expect(
      postSlackMessage({ secrets, channel: 'C123', text: 'test' }),
    ).rejects.toThrow(/SLACK|invalid/i);

    const result = buildRunResult({
      status: 'partial',
      workflow: 'on-demand',
      slackDelivered: false,
      failureReason: 'SLACK_POST_FAILED',
      reportPreview: 'Preview text',
    });
    expect(result.failureReason).toBe('SLACK_POST_FAILED');
    expect(result.slackDelivered).toBe(false);
  });
});
