import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DateTime } from 'luxon';
import type { EmCopilotConfig } from '../contracts/config.js';
import { resolveCommunicationAssistant } from '../contracts/config.js';
import {
  squadAnalysisArtifactSchema,
  type SquadAnalysisArtifact,
} from '../contracts/squad-analysis-artifact.js';

export interface LoadedArtifact {
  artifact: SquadAnalysisArtifact;
  artifactPath: string;
  possiblyStale: boolean;
}

export function getArtifactPath(config: EmCopilotConfig, squadId: string): string {
  const ca = resolveCommunicationAssistant(config);
  return join(ca.analysisArtifactDir, `${squadId}-latest.json`);
}

export function loadSquadAnalysisArtifact(
  config: EmCopilotConfig,
  squadId: string,
  options?: { fixturePath?: string },
): LoadedArtifact | null {
  const artifactPath = options?.fixturePath ?? getArtifactPath(config, squadId);
  if (!existsSync(artifactPath)) {
    return null;
  }

  const raw = JSON.parse(readFileSync(artifactPath, 'utf-8'));
  const artifact = squadAnalysisArtifactSchema.parse(raw);

  if (artifact.squadId !== squadId) {
    throw new Error(`Artifact squadId "${artifact.squadId}" does not match requested "${squadId}"`);
  }

  const ca = resolveCommunicationAssistant(config);
  const analyzedAt = DateTime.fromISO(artifact.analyzedAt);
  const possiblyStale = DateTime.now().diff(analyzedAt, 'hours').hours > ca.analysisFreshnessHours;

  return { artifact, artifactPath, possiblyStale };
}
