import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { analyzeSnapshot } from '../../../src/analysis/engine.js';
import { normalizedSquadSnapshotSchema } from '../../../src/contracts/normalized-squad-snapshot.js';
import { deterministicFindingsSchema } from '../../../src/contracts/deterministic-findings.js';
import { loadConfig } from '../../../src/config/load.js';

const config = loadConfig('config/em-copilot.example.yml');

describe('deterministic analysis rules', () => {
  it('detects stale in-progress beyond threshold', () => {
    const snapshot = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/storefront-sprint-active.json', 'utf-8')),
    );
    const squad = config.squads.find((s) => s.id === 'storefront')!;
    const findings = analyzeSnapshot(snapshot, squad);
    expect(findings.deliveryRisks.some((r) => r.category === 'staleInProgress')).toBe(true);
    expect(findings.deliveryRisks.find((r) => r.issueKeys.includes('SF-101'))).toBeDefined();
  });

  it('hygiene-only findings keep health On Track', () => {
    const snapshot = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/storefront-hygiene-only.json', 'utf-8')),
    );
    const squad = config.squads.find((s) => s.id === 'storefront')!;
    const findings = analyzeSnapshot(snapshot, squad);
    expect(findings.hygieneFindings.length).toBeGreaterThan(0);
    expect(findings.health.status).toBe('On Track');
  });

  it('classifies At Risk with 3+ delivery risks', () => {
    const snapshot = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/storefront-sprint-active.json', 'utf-8')),
    );
    const squad = config.squads.find((s) => s.id === 'storefront')!;
    const findings = analyzeSnapshot(snapshot, squad);
    if (findings.deliveryRisks.length >= 3) {
      expect(findings.health.status).toBe('At Risk');
    } else {
      expect(['Needs Attention', 'At Risk']).toContain(findings.health.status);
    }
    deterministicFindingsSchema.parse(findings);
  });

  it('classifies At Risk for unowned P0/P1 blocker', () => {
    const snapshot = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/storefront-sprint-active.json', 'utf-8')),
    );
    const squad = config.squads.find((s) => s.id === 'storefront')!;
    const findings = analyzeSnapshot(snapshot, squad);
    const unownedBlocker = findings.deliveryRisks.find((r) => r.category === 'unownedBlocker');
    expect(unownedBlocker).toBeDefined();
    expect(findings.health.status).toBe('At Risk');
  });

  it('detects WIP overload flow signal with neutral wording', () => {
    const snapshot = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/storefront-sprint-active.json', 'utf-8')),
    );
    // Add extra in-progress items for Alex to trigger WIP overload
    snapshot.workItems.push(
      {
        key: 'SF-200',
        summary: 'Extra WIP 1',
        projectKey: 'SF',
        boardType: 'scrum',
        priorityTier: 'P3',
        statusName: 'In Progress',
        statusCategory: 'inProgress',
        assigneeDisplayName: 'Alex Chen',
        ageInCurrentStatusBusinessDays: 1,
        daysSinceMeaningfulUpdate: 1,
      },
      {
        key: 'SF-201',
        summary: 'Extra WIP 2',
        projectKey: 'SF',
        boardType: 'scrum',
        priorityTier: 'P3',
        statusName: 'In Progress',
        statusCategory: 'inProgress',
        assigneeDisplayName: 'Alex Chen',
        ageInCurrentStatusBusinessDays: 1,
        daysSinceMeaningfulUpdate: 1,
      },
    );
    const squad = config.squads.find((s) => s.id === 'storefront')!;
    const findings = analyzeSnapshot(snapshot, squad);
    const wip = findings.flowSignals.find((s) => s.signalType === 'wipOverload');
    expect(wip).toBeDefined();
    expect(wip!.description).toContain('context switching');
    expect(wip!.description).not.toMatch(/slow|unproductive|underperform/i);
  });
});
