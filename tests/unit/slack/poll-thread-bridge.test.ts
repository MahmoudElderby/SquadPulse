import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pollThreadOnce, readCommandsBridge } from '../../../src/slack/poll-thread.js';

describe('commands bridge poll', () => {
  let dir: string;
  let bridge: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'followups-bridge-'));
    bridge = join(dir, 'commands.jsonl');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads JSONL entries newer than sinceTs', () => {
    writeFileSync(
      bridge,
      [
        JSON.stringify({ text: 'approve 1', ts: '100.1' }),
        JSON.stringify({ text: 'done', ts: '100.3' }),
        'not-json',
      ].join('\n'),
    );
    expect(readCommandsBridge(bridge, '100.1').map((m) => m.text)).toEqual(['done']);
  });

  it('returns bridge messages when client is null', async () => {
    writeFileSync(bridge, JSON.stringify({ text: 'status', ts: '200.2' }) + '\n');
    const messages = await pollThreadOnce(null, {
      channel: 'C1',
      threadTs: '200.0',
      sinceTs: '200.0',
      pollIntervalSeconds: 1,
      cycleMaxMinutes: 1,
      commandsBridgePath: bridge,
    });
    expect(messages).toEqual([{ text: 'status', ts: '200.2', user: undefined }]);
  });
});
