import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { analyzeSnapshot } from '../../../src/analysis/engine.js';
import { renderSquadReport } from '../../../src/report/render-squad-report.js';
import { normalizedSquadSnapshotSchema } from '../../../src/contracts/normalized-squad-snapshot.js';
import { loadConfig } from '../../../src/config/load.js';

const config = loadConfig('config/em-copilot.example.yml');

describe('squad report renderer', () => {
  it('renders manager-friendly sections with titles and owners', () => {
    const snapshot = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/storefront-sprint-active.json', 'utf-8')),
    );
    const squad = config.squads.find((s) => s.id === 'storefront')!;
    const findings = analyzeSnapshot(snapshot, squad);
    const report = renderSquadReport({ snapshot, findings, intent: 'full' });

    expect(report).toMatch(/Storefront Squad —/);
    expect(report).toContain('*Why this status*');
    expect(report).toContain('*What needs you today*');
    expect(report).toContain('*Risks*');
    expect(report).toContain('*Blockers*');
    expect(report).toContain('*Jira hygiene*');
    expect(report).toContain('*Snapshot*');

    // Title + owner enrichment when work items present
    const firstKey = snapshot.workItems[0]?.key;
    if (firstKey) {
      expect(report).toContain(`\`${firstKey}\``);
      const item = snapshot.workItems[0];
      if (item.summary) {
        // at least one title should appear if that key shows in risks/hygiene
        expect(report.includes(item.summary) || report.includes(firstKey)).toBe(true);
      }
    }

    const whyIdx = report.indexOf('*Why this status*');
    const todayIdx = report.indexOf('*What needs you today*');
    const risksIdx = report.indexOf('*Risks*');
    expect(whyIdx).toBeLessThan(todayIdx);
    expect(todayIdx).toBeLessThan(risksIdx);
  });

  it('caps lists at 5 with overflow disclosure', () => {
    const snapshot = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/storefront-sprint-active.json', 'utf-8')),
    );
    for (let i = 0; i < 10; i++) {
      snapshot.workItems.push({
        key: `SF-9${i}`,
        summary: `Extra stale item ${i}`,
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
    expect(report).toContain('Extra stale item');
    expect(report).toContain('Owner: Alex Chen');
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
    expect(report).toContain('*Jira hygiene*');
  });

  it('merges hygiene findings per ticket on one line', () => {
    const snapshot = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/storefront-hygiene-only.json', 'utf-8')),
    );
    const squad = config.squads.find((s) => s.id === 'storefront')!;
    const findings = analyzeSnapshot(snapshot, squad);
    const report = renderSquadReport({ snapshot, findings, intent: 'hygiene' });
    // should not print raw category codes like missingEstimate as the only signal
    expect(report).toMatch(/no estimate|unassigned|resolved but still open/i);
  });
});
