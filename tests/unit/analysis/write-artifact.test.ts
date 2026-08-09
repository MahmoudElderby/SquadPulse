import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../../../src/config/load.js';
import { buildSquadAnalysisArtifact, writeSquadAnalysisArtifact } from '../../../src/analysis/write-artifact.js';
import { loadSquadAnalysisArtifact } from '../../../src/followups/load-artifact.js';
import { loadFixtureSnapshot } from '../../../src/lib/fixture-mode.js';
import { analyzeSnapshot } from '../../../src/analysis/engine.js';

describe('write-artifact / load-artifact', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'squadpulse-artifact-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes and loads artifact with squad id filename', () => {
    const config = loadConfig('config/em-copilot.example.yml');
    const configWithDir = {
      ...config,
      communicationAssistant: {
        ...config.communicationAssistant,
        analysisArtifactDir: tempDir,
      },
    };
    const snapshot = loadFixtureSnapshot('storefront');
    const squad = config.squads.find((s) => s.id === 'storefront')!;
    const findings = analyzeSnapshot(snapshot, squad);

    const { artifactPath, artifact } = writeSquadAnalysisArtifact({
      config: configWithDir,
      snapshot,
      findings,
      workflow: 'on-demand',
    });

    expect(existsSync(artifactPath)).toBe(true);
    expect(artifactPath).toContain('storefront-latest.json');

    const loaded = loadSquadAnalysisArtifact(configWithDir, 'storefront');
    expect(loaded).not.toBeNull();
    expect(loaded!.artifact.squadId).toBe('storefront');
    expect(loaded!.artifact.deterministicFindings.deliveryRisks.length).toBeGreaterThanOrEqual(0);
  });

  it('buildSquadAnalysisArtifact maps snapshot fields', () => {
    const config = loadConfig('config/em-copilot.example.yml');
    const snapshot = loadFixtureSnapshot('storefront');
    const squad = config.squads.find((s) => s.id === 'storefront')!;
    const findings = analyzeSnapshot(snapshot, squad);

    const artifact = buildSquadAnalysisArtifact({
      config,
      snapshot,
      findings,
      workflow: 'daily',
    });

    expect(artifact.workflow).toBe('daily');
    expect(artifact.snapshot.workItems.length).toBe(snapshot.workItems.length);
    expect(artifact.snapshot.workItems[0]?.status).toBeDefined();
  });

  it('flags possiblyStale when analyzedAt exceeds freshness hours', () => {
    const config = loadConfig('config/em-copilot.example.yml');
    const staleArtifact = {
      squadId: 'storefront',
      squadDisplayName: 'Storefront',
      analyzedAt: '2020-01-01T00:00:00.000Z',
      workflow: 'on-demand',
      snapshot: { workItems: [] },
      deterministicFindings: {
        squadId: 'storefront',
        health: { status: 'On Track', reasons: [], deliveryRiskCount: 0 },
        deliveryRisks: [],
        blockers: [],
        hygieneFindings: [],
        flowSignals: [],
        managerActions: [],
      },
    };
    const path = join(tempDir, 'storefront-latest.json');
    writeFileSync(path, JSON.stringify(staleArtifact));

    const configWithDir = {
      ...config,
      communicationAssistant: { analysisFreshnessHours: 24, analysisArtifactDir: tempDir },
    };
    const loaded = loadSquadAnalysisArtifact(configWithDir, 'storefront');
    expect(loaded!.possiblyStale).toBe(true);
  });
});
