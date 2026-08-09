import type { WebClient } from '@slack/web-api';

export interface ThreadMessage {
  text: string;
  ts: string;
  user?: string;
}

export interface PollThreadOptions {
  channel: string;
  threadTs: string;
  sinceTs: string;
  pollIntervalSeconds: number;
  cycleMaxMinutes: number;
  dryRun?: boolean;
  /** Fixture mode: inject messages instead of polling Slack */
  fixtureMessages?: ThreadMessage[];
}

export async function fetchThreadRepliesSince(
  client: WebClient,
  channel: string,
  threadTs: string,
  sinceTs: string,
): Promise<ThreadMessage[]> {
  const res = await client.conversations.replies({
    channel,
    ts: threadTs,
    oldest: sinceTs,
    inclusive: false,
    limit: 100,
  });

  return (res.messages ?? [])
    .filter((m) => m.ts && m.ts > sinceTs && m.text)
    .map((m) => ({ text: m.text!, ts: m.ts!, user: m.user }));
}

export async function pollThreadOnce(
  client: WebClient | null,
  options: PollThreadOptions,
  sinceTs: string,
): Promise<ThreadMessage[]> {
  if (options.fixtureMessages) {
    return options.fixtureMessages.filter((m) => m.ts > sinceTs);
  }
  if (options.dryRun || !client) {
    return [];
  }
  return fetchThreadRepliesSince(client, options.channel, options.threadTs, sinceTs);
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function pollDeadline(cycleMaxMinutes: number): number {
  return Date.now() + cycleMaxMinutes * 60 * 1000;
}

export function isPastDeadline(deadlineMs: number): boolean {
  return Date.now() >= deadlineMs;
}
