import type { FollowUpProposal } from '../contracts/follow-up-proposal.js';

const LEVEL = { Low: 1, Medium: 2, High: 3 } as const;

export function urgencyScore(urgency: FollowUpProposal['urgency']): number {
  return LEVEL[urgency];
}

export function confidenceScore(confidence: FollowUpProposal['confidence']): number {
  return LEVEL[confidence];
}

export function compareProposals(a: FollowUpProposal, b: FollowUpProposal): number {
  const u = urgencyScore(b.urgency) - urgencyScore(a.urgency);
  if (u !== 0) return u;
  const c = confidenceScore(b.confidence) - confidenceScore(a.confidence);
  if (c !== 0) return c;
  return a.index - b.index;
}

export function deduplicateKey(proposal: Pick<FollowUpProposal, 'engineerDisplayName' | 'issueKey' | 'reasonType'>): string {
  return `${proposal.engineerDisplayName}|${proposal.issueKey}|${proposal.reasonType}`;
}

export interface DeduplicateResult {
  proposals: FollowUpProposal[];
  overflowCount: number;
  mergedCount: number;
}

export function deduplicateAndCapProposals(
  candidates: FollowUpProposal[],
  maxProposals: number,
): DeduplicateResult {
  const byKey = new Map<string, FollowUpProposal>();
  let mergedCount = 0;

  for (const candidate of candidates) {
    const key = deduplicateKey(candidate);
    const existing = byKey.get(key);
    if (existing) {
      existing.evidence = [...existing.evidence, ...candidate.evidence];
      mergedCount++;
      if (compareProposals(candidate, existing) < 0) {
        byKey.set(key, { ...existing, urgency: candidate.urgency, confidence: candidate.confidence });
      }
    } else {
      byKey.set(key, { ...candidate });
    }
  }

  const unique = [...byKey.values()].sort(compareProposals);
  const overflowCount = Math.max(0, unique.length - maxProposals);
  const capped = unique.slice(0, maxProposals).map((p, i) => ({ ...p, index: i + 1 }));

  return { proposals: capped, overflowCount, mergedCount };
}
