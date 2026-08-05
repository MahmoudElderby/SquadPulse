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

export function resolveSecrets(config: EmCopilotConfig): ResolvedSecrets {
  const names = { ...DEFAULT_ENV_NAMES, ...config.secrets?.envVarNames };

  const jiraBaseUrl = process.env[names.jiraBaseUrl] ?? config.jira.baseUrl;
  const jiraEmail = process.env[names.jiraEmail] ?? '';
  const jiraApiToken = process.env[names.jiraApiToken] ?? '';
  const slackBotToken = process.env[names.slackBotToken] ?? '';

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
