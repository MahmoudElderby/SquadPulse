import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { analyzeSnapshot } from '../../../src/analysis/engine.js';
import { renderSquadReport } from '../../../src/report/render-squad-report.js';
import { normalizedSquadSnapshotSchema } from '../../../src/contracts/normalized-squad-snapshot.js';
import { loadConfig } from '../../../src/config/load.js';

const config = loadConfig('config/em-copilot.example.yml');

describe('squad report renderer', () => {
  it('renders sections in fixed order', () => {
    const snapshot = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/storefront-sprint-active.json', 'utf-8')),
    );
    const squad = config.squads.find((s) => s.id === 'storefront')!;
    const findings = analyzeSnapshot(snapshot, squad);
    const report = renderSquadReport({ snapshot, findings, intent: 'full' });

    const healthIdx = report.indexOf('Overall Health');
    const factsIdx = report.indexOf('Key Facts');
    const risksIdx = report.indexOf('Delivery Risks');
    const blockersIdx = report.indexOf('Blockers');
    const hygieneIdx = report.indexOf('Jira Hygiene');
    const actionsIdx = report.indexOf('Prioritized Manager Actions');

    expect(healthIdx).toBeLessThan(factsIdx);
    expect(factsIdx).toBeLessThan(risksIdx);
    expect(risksIdx).toBeLessThan(blockersIdx);
    expect(blockersIdx).toBeLessThan(hygieneIdx);
    expect(hygieneIdx).toBeLessThan(actionsIdx);
  });

  it('caps lists at 5 with overflow disclosure', () => {
    const snapshot = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/storefront-sprint-active.json', 'utf-8')),
    );
    for (let i = 0; i < 10; i++) {
      snapshot.workItems.push({
        key: `SF-9${i}`,
        summary: `Extra ${i}`,
        projectKey: 'SF',
        boardType: 'scrum',
        priorityTier: 'P3',
        statusName: 'In Progress',
        statusCategory: 'inProgress',
        assigneeDisplayName: 'Alex Chen',
        ageInCurrentStatusBusinessDays: 10,
        daysSinceMeaningfulUpdate: 10,
      });
    }
    const squad = config.squads.find((s) => s.id === 'storefront')!;
    const findings = analyzeSnapshot(snapshot, squad);
    const report = renderSquadReport({ snapshot, findings, intent: 'full' });
    expect(report).toMatch(/\+[0-9]+ more risks not shown/);
  });

  it('does not downgrade health based on hygiene alone', () => {
    const snapshot = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/storefront-hygiene-only.json', 'utf-8')),
    );
    const squad = config.squads.find((s) => s.id === 'storefront')!;
    const findings = analyzeSnapshot(snapshot, squad);
    const report = renderSquadReport({ snapshot, findings, intent: 'full' });
    expect(findings.health.status).toBe('On Track');
    expect(report).toContain('On Track');
    expect(report).toContain('Jira Hygiene');
  });
});
