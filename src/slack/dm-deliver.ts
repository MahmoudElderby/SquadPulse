import { WebClient } from '@slack/web-api';
import type { ResolvedSecrets } from '../config/secrets.js';
import { withRetry } from '../lib/retry.js';

export interface DmDeliveryResult {
  ok: boolean;
  dmChannelId?: string;
  sentMessageTs?: string;
  error?: string;
  skipped?: boolean;
}

export interface EngineerReplyMessage {
  text: string;
  userId: string;
  ts: string;
}

export function createSlackClient(secrets: ResolvedSecrets): WebClient {
  return new WebClient(secrets.slackBotToken);
}

export async function openDmChannel(
  client: WebClient,
  userId: string,
): Promise<string | null> {
  const result = await withRetry(async () => {
    const res = await client.conversations.open({ users: userId });
    return res.channel?.id ?? null;
  });
  return result;
}

export async function postDirectMessage(
  client: WebClient,
  channelId: string,
  text: string,
): Promise<{ ts: string } | null> {
  const result = await withRetry(async () => {
    const res = await client.chat.postMessage({ channel: channelId, text });
    return res.ts ? { ts: res.ts } : null;
  });
  return result;
}

export async function deliverDirectMessage(
  client: WebClient,
  slackUserId: string | undefined,
  text: string,
): Promise<DmDeliveryResult> {
  if (!slackUserId) {
    return { ok: false, skipped: true, error: 'missing recipient mapping' };
  }

  try {
    const dmChannelId = await openDmChannel(client, slackUserId);
    if (!dmChannelId) {
      return { ok: false, error: 'could not open DM channel' };
    }
    const posted = await postDirectMessage(client, dmChannelId, text);
    if (!posted) {
      return { ok: false, error: 'post message returned no ts' };
    }
    return { ok: true, dmChannelId, sentMessageTs: posted.ts };
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function readDmReplies(
  client: WebClient,
  dmChannelId: string,
  sentMessageTs: string,
  engineerUserId: string,
): Promise<EngineerReplyMessage[]> {
  const history = await withRetry(async () => {
    const res = await client.conversations.history({
      channel: dmChannelId,
      oldest: sentMessageTs,
      inclusive: false,
      limit: 50,
    });
    return res.messages ?? [];
  });

  return history
    .filter((m) => m.user === engineerUserId && m.text && m.ts && m.ts > sentMessageTs)
    .map((m) => ({
      text: m.text!,
      userId: m.user!,
      ts: m.ts!,
    }));
}
