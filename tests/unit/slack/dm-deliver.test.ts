import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOpen = vi.fn();
const mockPost = vi.fn();

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    conversations: { open: mockOpen },
    chat: { postMessage: mockPost },
  })),
}));

import { deliverDirectMessage } from '../../../src/slack/dm-deliver.js';
import { WebClient } from '@slack/web-api';

describe('dm-deliver', () => {
  beforeEach(() => {
    mockOpen.mockReset();
    mockPost.mockReset();
  });

  it('sends DM successfully', async () => {
    mockOpen.mockResolvedValue({ channel: { id: 'D123' } });
    mockPost.mockResolvedValue({ ts: '1234.5678' });

    const client = new WebClient('x-token');
    const result = await deliverDirectMessage(client, 'U001', 'Hello');

    expect(result.ok).toBe(true);
    expect(result.dmChannelId).toBe('D123');
    expect(result.sentMessageTs).toBe('1234.5678');
  });

  it('skips when slack user id missing', async () => {
    const client = new WebClient('x-token');
    const result = await deliverDirectMessage(client, undefined, 'Hello');
    expect(result.skipped).toBe(true);
    expect(result.error).toContain('missing recipient mapping');
  });

  it('does not retry on auth failure', async () => {
    mockOpen.mockRejectedValue(Object.assign(new Error('invalid_auth'), { status: 401 }));
    const client = new WebClient('bad-token');
    await expect(deliverDirectMessage(client, 'U001', 'Hello')).rejects.toMatchObject({ status: 401 });
  });

  it('retries on rate limit then succeeds', async () => {
    mockOpen
      .mockRejectedValueOnce(Object.assign(new Error('rate_limited'), { status: 429 }))
      .mockResolvedValueOnce({ channel: { id: 'D123' } });
    mockPost.mockResolvedValue({ ts: '999.0001' });

    const client = new WebClient('x-token');
    const result = await deliverDirectMessage(client, 'U001', 'Hello');
    expect(result.ok).toBe(true);
    expect(mockOpen).toHaveBeenCalledTimes(2);
  });
});
