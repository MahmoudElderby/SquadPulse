import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadConfig } from '../../../src/config/load.js';
import { mapFindingsToProposals } from '../../../src/followups/map-findings-to-proposals.js';
import { squadAnalysisArtifactSchema } from '../../../src/contracts/squad-analysis-artifact.js';

const config = loadConfig('fixtures/config/followups-orion.yml');
const artifact = squadAnalysisArtifactSchema.parse(
  JSON.parse(readFileSync('fixtures/analysis/orion-mixed-findings.json', 'utf-8')),
);

describe('mapFindingsToProposals', () => {
  it('maps stale in-progress to progress-update', () => {
    const result = mapFindingsToProposals(artifact, config);
    const stale = result.proposals.find((p) => p.issueKey === 'MTN-101');
    expect(stale?.reasonType).toBe('progress-update');
    expect(stale?.engineerDisplayName).toBe('Alex Chen');
  });

  it('maps unowned blocker to blocker-clarification', () => {
    const result = mapFindingsToProposals(artifact, config);
    const blocker = result.proposals.find((p) => p.issueKey === 'MTN-102');
    expect(blocker?.reasonType).toBe('blocker-clarification');
  });

  it('maps missing estimate to estimate-reminder', () => {
    const result = mapFindingsToProposals(artifact, config);
    const estimate = result.proposals.find((p) => p.issueKey === 'MTN-103');
    expect(estimate?.reasonType).toBe('estimate-reminder');
  });

  it('maps sprint risk when health At Risk', () => {
    const result = mapFindingsToProposals(artifact, config);
    const risk = result.proposals.find((p) => p.issueKey === 'MTN-104');
    expect(risk?.reasonType).toBe('sprint-risk-clarification');
  });

  it('skips unmapped flow signals with disclosure', () => {
    const artifactWithFlow = {
      ...artifact,
      deterministicFindings: {
        ...artifact.deterministicFindings,
        flowSignals: [
          {
            signalType: 'wipOverload' as const,
            description: 'Too many WIP',
            relatedIssueKeys: ['MTN-999'],
          },
        ],
      },
    };
    const result = mapFindingsToProposals(artifactWithFlow, config);
    expect(result.skipped.some((s) => s.issueKey === 'MTN-999')).toBe(true);
  });
});
