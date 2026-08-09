import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isMissingHistoryScopeError, readCommandsBridgeSince } from '../../../src/slack/commands-bridge.js';

describe('commands-bridge', () => {
  it('returns messages newer than sinceTs in ts order', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bridge-'));
    const path = join(dir, 'commands.jsonl');
    writeFileSync(
      path,
      [
        JSON.stringify({ text: 'approve 1', ts: '100.002' }),
        JSON.stringify({ text: 'ignore 2', ts: '100.001' }),
        JSON.stringify({ text: 'old', ts: '100.000' }),
        'not-json',
        JSON.stringify({ text: 'done', ts: '100.003', user: 'U1' }),
      ].join('\n'),
    );

    expect(readCommandsBridgeSince(path, '100.000')).toEqual([
      { text: 'ignore 2', ts: '100.001', user: undefined },
      { text: 'approve 1', ts: '100.002', user: undefined },
      { text: 'done', ts: '100.003', user: 'U1' },
    ]);
  });

  it('returns empty when bridge file is missing', () => {
    expect(readCommandsBridgeSince('/tmp/does-not-exist-bridge.jsonl', '0')).toEqual([]);
  });

  it('detects missing history scope errors', () => {
    expect(
      isMissingHistoryScopeError({
        data: { error: 'missing_scope', needed: 'channels:history' },
      }),
    ).toBe(true);
    expect(isMissingHistoryScopeError(new Error('nope'))).toBe(false);
  });
});
