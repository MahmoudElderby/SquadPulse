import type { ContextualAnalysis } from '../contracts/contextual-analysis.js';
import type { DeterministicFindings } from '../contracts/deterministic-findings.js';

export function mergeContextualAnalysis(
  findings: DeterministicFindings,
  contextual: ContextualAnalysis,
): { findings: DeterministicFindings; contextual: ContextualAnalysis } {
  // Health classification is deterministic-only — never override
  const mergedFindings: DeterministicFindings = {
    ...findings,
    keyFacts: [
      ...(findings.keyFacts ?? []),
      ...(contextual.keyFactsNarrative ?? []),
    ],
  };

  return {
    findings: mergedFindings,
    contextual: {
      ...contextual,
      followUpDrafts: contextual.followUpDrafts,
    },
  };
}
