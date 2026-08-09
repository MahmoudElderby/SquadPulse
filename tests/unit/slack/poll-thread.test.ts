import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fetchThreadRepliesSince, pollThreadOnce } from '../../../src/slack/poll-thread.js';
import type { WebClient } from '@slack/web-api';

describe('poll-thread', () => {
  it('pollThreadOnce passes options.sinceTs to conversations.replies', async () => {
    const replies = vi.fn().mockResolvedValue({
      messages: [
        { ts: '100.000', text: 'followups Orion' },
        { ts: '100.001', text: 'approve 1' },
      ],
    });
    const client = { conversations: { replies } } as unknown as WebClient;

    const messages = await pollThreadOnce(client, {
      channel: 'C123',
      threadTs: '100.000',
      sinceTs: '100.000',
      pollIntervalSeconds: 5,
      cycleMaxMinutes: 60,
    });

    expect(replies).toHaveBeenCalledWith({
      channel: 'C123',
      ts: '100.000',
      oldest: '100.000',
      inclusive: false,
      limit: 100,
    });
    expect(messages).toEqual([{ text: 'approve 1', ts: '100.001', user: undefined }]);
  });

  it('fetchThreadRepliesSince filters messages at or before sinceTs', async () => {
    const replies = vi.fn().mockResolvedValue({
      messages: [
        { ts: '200.000', text: 'approve 1' },
        { ts: '200.001', text: 'done', user: 'U1' },
      ],
    });
    const client = { conversations: { replies } } as unknown as WebClient;

    const messages = await fetchThreadRepliesSince(client, 'C123', '100.000', '200.000');

    expect(messages).toEqual([{ text: 'done', ts: '200.001', user: 'U1' }]);
  });

  it('pollThreadOnce reads --commands-bridge JSONL and skips Slack API', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bridge-poll-'));
    const bridgePath = join(dir, 'commands.jsonl');
    writeFileSync(bridgePath, `${JSON.stringify({ text: 'approve 1', ts: '300.001' })}\n`);
    const replies = vi.fn();
    const client = { conversations: { replies } } as unknown as WebClient;

    const messages = await pollThreadOnce(client, {
      channel: 'C123',
      threadTs: '300.000',
      sinceTs: '300.000',
      pollIntervalSeconds: 5,
      cycleMaxMinutes: 60,
      commandsBridgePath: bridgePath,
    });

    expect(replies).not.toHaveBeenCalled();
    expect(messages).toEqual([{ text: 'approve 1', ts: '300.001', user: undefined }]);
  });
});
