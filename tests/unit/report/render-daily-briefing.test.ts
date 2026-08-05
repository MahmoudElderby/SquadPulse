import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildDailyBriefingAggregate } from '../../../src/report/render-daily-briefing.js';
import { dailyBriefingSchema } from '../../../src/contracts/daily-briefing.js';
import { analyzeSnapshot } from '../../../src/analysis/engine.js';
import { normalizedSquadSnapshotSchema } from '../../../src/contracts/normalized-squad-snapshot.js';
import { loadConfig } from '../../../src/config/load.js';

const config = loadConfig('config/em-copilot.example.yml');

describe('daily briefing renderer', () => {
  it('produces aggregate matching daily-briefing schema', () => {
    const storefront = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/storefront-sprint-active.json', 'utf-8')),
    );
    const payments = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/payments-mixed-boards.json', 'utf-8')),
    );

    const sfFindings = analyzeSnapshot(storefront, config.squads[0]);
    const payFindings = analyzeSnapshot(payments, config.squads[1]);

    const briefing = buildDailyBriefingAggregate({
      generatedAt: new Date().toISOString(),
      timezone: 'America/New_York',
      reportDate: '2026-08-06',
      isRefresh: false,
      squadSummaries: [
        {
          squadId: 'storefront',
          displayName: 'Storefront',
          oneLineStatus: '2 risks',
          healthStatus: sfFindings.health.status,
        },
        {
          squadId: 'payments',
          displayName: 'Payments',
          oneLineStatus: '1 risk',
          healthStatus: payFindings.health.status,
        },
      ],
      crossSquadPriorities: [],
      perSquadFindings: [
        { squadId: 'storefront', findings: sfFindings },
        { squadId: 'payments', findings: payFindings },
      ],
      limitations: [],
    });

    expect(() => dailyBriefingSchema.parse(briefing)).not.toThrow();
    expect(briefing.squadSummaries).toHaveLength(2);
  });
});
