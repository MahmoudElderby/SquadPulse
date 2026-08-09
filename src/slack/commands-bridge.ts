import { existsSync, readFileSync } from 'node:fs';
import type { ThreadMessage } from './poll-thread.js';

/**
 * Read manager commands from a JSONL bridge file (one JSON object per line).
 * Used when the bot token lacks channels:history and an orchestrator
 * (e.g. Cursor Automation with MCP read_slack_messages) feeds thread replies.
 *
 * Line shape: {"text":"approve 1","ts":"123.456","user":"U…"}
 */
export function readCommandsBridgeSince(bridgePath: string, sinceTs: string): ThreadMessage[] {
  if (!existsSync(bridgePath)) {
    return [];
  }

  const raw = readFileSync(bridgePath, 'utf-8');
  const messages: ThreadMessage[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as { text?: unknown; ts?: unknown; user?: unknown };
      if (typeof parsed.text !== 'string' || typeof parsed.ts !== 'string') continue;
      if (parsed.ts <= sinceTs) continue;
      messages.push({
        text: parsed.text,
        ts: parsed.ts,
        user: typeof parsed.user === 'string' ? parsed.user : undefined,
      });
    } catch {
      // skip malformed lines
    }
  }

  messages.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  return messages;
}

export function isMissingHistoryScopeError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const data = (err as { data?: { error?: string; needed?: string } }).data;
  return data?.error === 'missing_scope' && typeof data.needed === 'string' && data.needed.includes('history');
}
