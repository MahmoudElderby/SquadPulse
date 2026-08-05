import { WebClient } from '@slack/web-api';
import { redactSecrets, type ResolvedSecrets } from '../config/secrets.js';

export class SlackPostError extends Error {
  readonly code = 'SLACK_POST_FAILED';

  constructor(message: string) {
    super(message);
    this.name = 'SlackPostError';
  }
}

export async function postSlackMessage(options: {
  secrets: ResolvedSecrets;
  channel: string;
  text: string;
  threadTs?: string;
}): Promise<{ ok: boolean; ts?: string }> {
  const client = new WebClient(options.secrets.slackBotToken);

  try {
    const result = await client.chat.postMessage({
      channel: options.channel,
      text: redactSecrets(options.text, options.secrets),
      thread_ts: options.threadTs,
      mrkdwn: true,
    });

    if (!result.ok) {
      throw new SlackPostError(result.error ?? 'Unknown Slack error');
    }

    return { ok: true, ts: result.ts as string };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SlackPostError(redactSecrets(message, options.secrets));
  }
}

export function dryRunPost(text: string): { ok: boolean; preview: string } {
  return { ok: true, preview: text.slice(0, 500) };
}
