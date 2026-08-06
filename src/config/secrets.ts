import type { EmCopilotConfig } from '../contracts/config.js';

export interface ResolvedSecrets {
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
  slackBotToken: string;
}

const DEFAULT_ENV_NAMES = {
  jiraBaseUrl: 'JIRA_BASE_URL',
  jiraEmail: 'JIRA_EMAIL',
  jiraApiToken: 'JIRA_API_TOKEN',
  slackBotToken: 'SLACK_BOT_TOKEN',
};

/**
 * Normalize Jira site URL for fetch().
 * - Empty env falls back to config (empty string must not win over ?? ).
 * - Bare hostnames get https://.
 * - Trailing slashes removed.
 */
export function normalizeJiraBaseUrl(raw: string | undefined | null, fallback?: string): string {
  let value = (raw ?? '').trim();
  if (!value && fallback) {
    value = fallback.trim();
  }
  if (!value) {
    throw new Error(
      'Jira base URL is empty. Set JIRA_BASE_URL secret to https://your-site.atlassian.net (include https://) or set jira.baseUrl in config.',
    );
  }

  // Strip accidental wrapping quotes from dashboard secret paste
  value = value.replace(/^['"]|['"]$/g, '');

  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  value = value.replace(/\/+$/, '');

  try {
    const u = new URL(value);
    if (!u.hostname) {
      throw new Error('missing hostname');
    }
    // Discard accidental path (e.g. someone pasted a browse URL)
    return `${u.protocol}//${u.host}`;
  } catch {
    throw new Error(
      `Invalid Jira base URL "${value.slice(0, 40)}…". Expected https://your-site.atlassian.net`,
    );
  }
}

export function resolveSecrets(config: EmCopilotConfig): ResolvedSecrets {
  const names = { ...DEFAULT_ENV_NAMES, ...config.secrets?.envVarNames };

  const envBase = process.env[names.jiraBaseUrl];
  // Treat blank env as unset so config.jira.baseUrl can apply
  const jiraBaseUrl = normalizeJiraBaseUrl(
    envBase && envBase.trim() ? envBase : undefined,
    config.jira.baseUrl,
  );
  const jiraEmail = (process.env[names.jiraEmail] ?? '').trim();
  const jiraApiToken = (process.env[names.jiraApiToken] ?? '').trim();
  const slackBotToken = (process.env[names.slackBotToken] ?? '').trim();

  return { jiraBaseUrl, jiraEmail, jiraApiToken, slackBotToken };
}

export function redactSecrets(text: string, secrets: ResolvedSecrets): string {
  let result = text;
  for (const value of Object.values(secrets)) {
    if (value && value.length > 4) {
      result = result.split(value).join('[REDACTED]');
    }
  }
  return result;
}

/** Safe host for logs/limitations without exposing tokens. */
export function jiraHostForDisplay(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return '(invalid-host)';
  }
}
