import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { analyzeSnapshot } from '../../src/analysis/engine.js';
import { normalizedSquadSnapshotSchema } from '../../src/contracts/normalized-squad-snapshot.js';
import { deterministicFindingsSchema } from '../../src/contracts/deterministic-findings.js';
import { loadConfig } from '../../src/config/load.js';

describe('fixture pipeline integration', () => {
  it('produces schema-valid DeterministicFindings for storefront fixture', () => {
    const config = loadConfig('config/em-copilot.example.yml');
    const snapshot = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/storefront-sprint-active.json', 'utf-8')),
    );
    const squad = config.squads.find((s) => s.id === 'storefront')!;
    const findings = analyzeSnapshot(snapshot, squad);
    expect(() => deterministicFindingsSchema.parse(findings)).not.toThrow();
    expect(findings.squadId).toBe('storefront');
  });

  it('produces schema-valid findings for payments fixture', () => {
    const config = loadConfig('config/em-copilot.example.yml');
    const snapshot = normalizedSquadSnapshotSchema.parse(
      JSON.parse(readFileSync('fixtures/jira/payments-mixed-boards.json', 'utf-8')),
    );
    const squad = config.squads.find((s) => s.id === 'payments')!;
    const findings = analyzeSnapshot(snapshot, squad);
    expect(() => deterministicFindingsSchema.parse(findings)).not.toThrow();
  });
});
