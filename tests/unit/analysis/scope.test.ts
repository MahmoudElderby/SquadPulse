import { describe, it, expect } from 'vitest';
import { parseScopeFromText, applyScopeToSnapshot } from '../../../src/analysis/scope.js';
import { parseSlackRequest } from '../../../src/slack/parse-request.js';
import { loadConfig } from '../../../src/config/load.js';
import { readFileSync } from 'node:fs';
import { normalizedSquadSnapshotSchema } from '../../../src/contracts/normalized-squad-snapshot.js';

const config = loadConfig('config/em-copilot.example.yml');

describe('analysis scope (portable focus filters)', () => {
  it('extracts issue keys from free text', () => {
    const scope = parseScopeFromText('analyze Orion focus on MTN-11155 and MTN-11458');
    expect(scope.issueKeys).toEqual(expect.arrayContaining(['MTN-11155', 'MTN-11458']));
  });

  it('extracts assignee from "focus on Name tickets"', () => {
    const scope = parseScopeFromText(
      'analyze Orion tickets focus on Mohamed Mostafa tickets',
    );
    expect(scope.assignees?.some((a) => /mohamed\s+mostafa/i.test(a))).toBe(true);
  });

  it('parseSlackRequest attaches scope for person + squad', () => {
    const result = parseSlackRequest(
      'analyze Storefront tickets focus on Alex Chen tickets',
      config,
    );
    expect(result.kind).toBe('analysis');
    if (result.kind === 'analysis') {
      expect(result.scope?.assignees?.length).toBeGreaterThan(0);
    }
  });

  it('applyScopeToSnapshot filters by assignee', () => {
    const snapshot = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/storefront-sprint-active.json', 'utf-8')),
    );
    const person = snapshot.workItems.find((w) => w.assigneeDisplayName)?.assigneeDisplayName;
    expect(person).toBeTruthy();
    const scoped = applyScopeToSnapshot(snapshot, { assignees: [person!] });
    expect(scoped.applied).toBe(true);
    expect(scoped.snapshot.workItems.every((w) => w.assigneeDisplayName === person)).toBe(true);
    expect(scoped.matched).toBeLessThanOrEqual(snapshot.workItems.length);
  });

  it('applyScopeToSnapshot filters by issue keys', () => {
    const snapshot = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/storefront-sprint-active.json', 'utf-8')),
    );
    const key = snapshot.workItems[0].key;
    const scoped = applyScopeToSnapshot(snapshot, { issueKeys: [key] });
    expect(scoped.snapshot.workItems).toHaveLength(1);
    expect(scoped.snapshot.workItems[0].key).toBe(key);
  });
});
