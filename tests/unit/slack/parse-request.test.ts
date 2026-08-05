import { describe, it, expect } from 'vitest';
import { parseSlackRequest } from '../../../src/slack/parse-request.js';
import { loadConfig } from '../../../src/config/load.js';

const config = loadConfig('config/em-copilot.example.yml');

describe('Slack request parser', () => {
  it('resolves squad by display name', () => {
    const result = parseSlackRequest('analyze Storefront squad', config);
    expect(result.kind).toBe('analysis');
    if (result.kind === 'analysis') {
      expect(result.squadId).toBe('storefront');
      expect(result.intent).toBe('full');
    }
  });

  it('resolves squad by alias', () => {
    const result = parseSlackRequest('show blockers for pay team', config);
    expect(result.kind).toBe('analysis');
    if (result.kind === 'analysis') {
      expect(result.squadId).toBe('payments');
      expect(result.intent).toBe('blockers');
    }
  });

  it('applies intent keyword precedence (follow-up over full)', () => {
    const result = parseSlackRequest('analyze Storefront follow-up drafts', config);
    expect(result.kind).toBe('analysis');
    if (result.kind === 'analysis') {
      expect(result.intent).toBe('follow-up');
    }
  });

  it('returns unknown squad for unrecognized name', () => {
    const result = parseSlackRequest('analyze Growth squad', config);
    expect(result.kind).toBe('unknownSquad');
    if (result.kind === 'unknownSquad') {
      expect(result.configuredSquads).toHaveLength(2);
    }
  });

  it('returns unknown intent when no keywords match', () => {
    const result = parseSlackRequest('hello there Payments', config);
    expect(result.kind).toBe('unknownIntent');
  });
});
