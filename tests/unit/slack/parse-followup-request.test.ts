import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../../src/config/load.js';
import { parseFollowUpRequest, isFollowUpManagerCommand } from '../../../src/slack/parse-followup-request.js';

const config = loadConfig('fixtures/config/followups-orion.yml');

describe('parseFollowUpRequest', () => {
  it('parses startCycle with squad name', () => {
    const result = parseFollowUpRequest('followups Orion', config);
    expect(result.kind).toBe('startCycle');
    if (result.kind === 'startCycle') {
      expect(result.squadId).toBe('orion');
    }
  });

  it('parses singular followup startCycle trigger', () => {
    const result = parseFollowUpRequest('followup orion', config);
    expect(result.kind).toBe('startCycle');
    if (result.kind === 'startCycle') {
      expect(result.squadId).toBe('orion');
    }
  });

  it('parses approve with indexes', () => {
    const result = parseFollowUpRequest('approve 1,2', config);
    expect(result.kind).toBe('approve');
    if (result.kind === 'approve') {
      expect(result.proposalIndexes).toEqual([1, 2]);
    }
  });

  it('parses edit command', () => {
    const result = parseFollowUpRequest('edit 3: Can you share an ETA?', config);
    expect(result.kind).toBe('edit');
    if (result.kind === 'edit') {
      expect(result.proposalIndexes).toEqual([3]);
      expect(result.editedText).toContain('ETA');
    }
  });

  it('parses ignore command', () => {
    const result = parseFollowUpRequest('ignore 4', config);
    expect(result.kind).toBe('ignore');
  });

  it('parses approve all', () => {
    expect(parseFollowUpRequest('approve all', config).kind).toBe('approveAll');
  });

  it('parses status and closeCycle', () => {
    expect(parseFollowUpRequest('status', config).kind).toBe('status');
    expect(parseFollowUpRequest('done', config).kind).toBe('closeCycle');
  });

  it('returns unknownSquad for unrecognized squad on startCycle', () => {
    const result = parseFollowUpRequest('followups Growth', config);
    expect(result.kind).toBe('unknownSquad');
  });

  it('returns unknownCommand for invalid approve index format', () => {
    const result = parseFollowUpRequest('approve foo', config);
    expect(result.kind).toBe('unknownCommand');
  });
});

describe('isFollowUpManagerCommand', () => {
  it('matches manager commands only', () => {
    expect(isFollowUpManagerCommand('approve 1')).toBe(true);
    expect(isFollowUpManagerCommand('approve all')).toBe(true);
    expect(isFollowUpManagerCommand('status')).toBe(true);
    expect(isFollowUpManagerCommand('done')).toBe(true);
  });

  it('rejects bot preview text and start triggers', () => {
    expect(isFollowUpManagerCommand('*Follow-up proposals — Orion*')).toBe(false);
    expect(isFollowUpManagerCommand('followups Orion')).toBe(false);
    expect(isFollowUpManagerCommand('thanks')).toBe(false);
  });
});
