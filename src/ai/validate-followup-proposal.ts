import { followUpProposalSchema } from '../contracts/follow-up-proposal.js';

const PROHIBITED_PATTERNS = [
  /\bperformance\b/i,
  /\branking\b/i,
  /\bscore\b/i,
  /\burgency\s*:\s*(low|medium|high)\b/i,
  /\bconfidence\s*:\s*(low|medium|high)\b/i,
  /\b\d+\s*%\b/,
  /\byou always\b/i,
  /\byou never\b/i,
];

export function checkProhibitedLanguage(text: string): string[] {
  const violations: string[] = [];
  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`Prohibited language matched: ${pattern.source}`);
    }
  }
  return violations;
}

export function validateFollowUpProposalDraft(raw: unknown): {
  valid: boolean;
  draftMessage?: string;
  errors: string[];
} {
  const parsed = followUpProposalSchema.safeParse(raw);
  if (!parsed.success) {
    return { valid: false, errors: parsed.error.issues.map((i) => i.message) };
  }

  const languageErrors = checkProhibitedLanguage(parsed.data.draftMessage);
  if (languageErrors.length) {
    return { valid: false, errors: languageErrors };
  }

  return { valid: true, draftMessage: parsed.data.draftMessage, errors: [] };
}
