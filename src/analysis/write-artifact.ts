import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EmCopilotConfig } from '../contracts/config.js';
import { resolveCommunicationAssistant } from '../contracts/config.js';
import type { NormalizedSquadSnapshot } from '../contracts/normalized-squad-snapshot.js';
import type { DeterministicFindings } from '../contracts/deterministic-findings.js';
import type { ContextualAnalysis } from '../contracts/contextual-analysis.js';
import {
  squadAnalysisArtifactSchema,
  type SquadAnalysisArtifact,
} from '../contracts/squad-analysis-artifact.js';

export interface WriteArtifactInput {
  config: EmCopilotConfig;
  snapshot: NormalizedSquadSnapshot;
  findings: DeterministicFindings;
  contextual?: ContextualAnalysis;
  workflow: 'on-demand' | 'daily';
}

export function buildSquadAnalysisArtifact(input: WriteArtifactInput): SquadAnalysisArtifact {
  const { snapshot, findings, contextual, workflow } = input;
  const workItems = snapshot.workItems.map((item) => ({
    key: item.key,
    summary: item.summary,
    status: item.statusName,
    priorityTier: item.priorityTier,
    assigneeDisplayName: item.assigneeDisplayName ?? null,
    storyPoints: item.storyPoints ?? null,
    updatedAt: item.updatedAt,
  }));

  const sprints = [];
  if (snapshot.activeSprint) {
    sprints.push({
      id: snapshot.activeSprint.id,
      name: snapshot.activeSprint.name,
      state: snapshot.activeSprint.state,
      startDate: snapshot.activeSprint.startDate,
      endDate: snapshot.activeSprint.endDate,
    });
  }
  if (snapshot.previousSprint) {
    sprints.push({
      id: snapshot.previousSprint.id,
      name: snapshot.previousSprint.name,
      state: snapshot.previousSprint.state,
      startDate: snapshot.previousSprint.startDate,
      endDate: snapshot.previousSprint.endDate,
    });
  }

  const limitations = [
    ...(snapshot.limitations ?? []),
    ...(findings.limitations ?? []),
  ];

  return squadAnalysisArtifactSchema.parse({
    squadId: snapshot.squadId,
    squadDisplayName: snapshot.displayName,
    analyzedAt: snapshot.generatedAt,
    workflow,
    snapshot: { sprints, workItems },
    deterministicFindings: findings,
    contextualAnalysis: contextual,
    limitations: limitations.length ? limitations : undefined,
  });
}

export function writeSquadAnalysisArtifact(
  input: WriteArtifactInput,
): { artifactPath: string; artifact: SquadAnalysisArtifact } {
  const ca = resolveCommunicationAssistant(input.config);
  const artifact = buildSquadAnalysisArtifact(input);
  const dir = ca.analysisArtifactDir;
  mkdirSync(dir, { recursive: true });
  const artifactPath = join(dir, `${artifact.squadId}-latest.json`);
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), 'utf-8');
  return { artifactPath, artifact };
}
