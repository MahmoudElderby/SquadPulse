import { describe, it, expect, afterEach } from 'vitest';
import { normalizeJiraBaseUrl, resolveSecrets } from '../../../src/config/secrets.js';
import { loadConfig } from '../../../src/config/load.js';

describe('normalizeJiraBaseUrl', () => {
  it('adds https when scheme missing', () => {
    expect(normalizeJiraBaseUrl('paysky1.atlassian.net')).toBe('https://paysky1.atlassian.net');
  });

  it('strips path and trailing slash', () => {
    expect(normalizeJiraBaseUrl('https://paysky1.atlassian.net/jira/software/c/projects/MTN/')).toBe(
      'https://paysky1.atlassian.net',
    );
  });

  it('falls back when empty', () => {
    expect(normalizeJiraBaseUrl('', 'https://example.atlassian.net')).toBe(
      'https://example.atlassian.net',
    );
  });
});

describe('resolveSecrets empty env', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('uses config baseUrl when env is blank string', () => {
    process.env.JIRA_BASE_URL = '   ';
    process.env.JIRA_EMAIL = 'a@b.com';
    process.env.JIRA_API_TOKEN = 'token';
    const config = loadConfig('config/em-copilot.example.yml');
    const secrets = resolveSecrets(config);
    expect(secrets.jiraBaseUrl).toMatch(/^https:\/\//);
  });
});
