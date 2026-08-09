import { existsSync, readFileSync } from 'node:fs';
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
  /**
   * Optional JSONL bridge file (one {"text","ts","user"?} per line).
   * Used when the bot token lacks channels:history and an external agent feeds commands.
   */
  commandsBridgePath?: string;
}

export class SlackHistoryScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlackHistoryScopeError';
  }
}

function isMissingHistoryScope(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const platform = err as { code?: string; data?: { error?: string; needed?: string } };
  if (platform.code !== 'slack_webapi_platform_error') return false;
  if (platform.data?.error !== 'missing_scope') return false;
  const needed = platform.data.needed ?? '';
  return needed.includes('history');
}

export async function fetchThreadRepliesSince(
  client: WebClient,
  channel: string,
  threadTs: string,
  sinceTs: string,
): Promise<ThreadMessage[]> {
  try {
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
  } catch (err) {
    if (isMissingHistoryScope(err)) {
      throw new SlackHistoryScopeError(
        'Slack bot token is missing channels:history (or groups:history) required to poll the manager thread',
      );
    }
    throw err;
  }
}

/** Read JSONL command bridge entries newer than sinceTs. */
export function readCommandsBridge(path: string, sinceTs: string): ThreadMessage[] {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  const out: ThreadMessage[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as { text?: string; ts?: string; user?: string };
      if (parsed.text && parsed.ts && parsed.ts > sinceTs) {
        out.push({ text: parsed.text, ts: parsed.ts, user: parsed.user });
      }
    } catch {
      // skip malformed lines
    }
  }
  return out.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
}

export async function pollThreadOnce(
  client: WebClient | null,
  options: PollThreadOptions,
): Promise<ThreadMessage[]> {
  if (options.fixtureMessages) {
    return options.fixtureMessages.filter((m) => m.ts > options.sinceTs);
  }

  const bridged = options.commandsBridgePath
    ? readCommandsBridge(options.commandsBridgePath, options.sinceTs)
    : [];

  if (options.dryRun || !client) {
    return bridged;
  }

  try {
    const fromSlack = await fetchThreadRepliesSince(
      client,
      options.channel,
      options.threadTs,
      options.sinceTs,
    );
    if (!bridged.length) return fromSlack;
    const byTs = new Map<string, ThreadMessage>();
    for (const m of [...fromSlack, ...bridged]) byTs.set(m.ts, m);
    return [...byTs.values()].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  } catch (err) {
    if (err instanceof SlackHistoryScopeError) {
      if (bridged.length || options.commandsBridgePath) {
        return bridged;
      }
      throw err;
    }
    throw err;
  }
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
