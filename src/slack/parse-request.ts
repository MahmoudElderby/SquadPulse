import type { EmCopilotConfig } from '../contracts/config.js';
import type { ParsedSlackRequest, ParsedAnalysisRequest } from '../contracts/slack-request.js';
import { parseScopeFromText } from '../analysis/scope.js';

const INTENTS = ['follow-up', 'hygiene', 'stale', 'blockers', 'sprint', 'full'] as const;
const INTENT_KEYWORDS: Record<(typeof INTENTS)[number], string[]> = {
  'follow-up': ['follow-up', 'follow up', 'followup', 'draft'],
  hygiene: ['hygiene', 'clean up', 'cleanup', 'jira hygiene'],
  stale: ['stale', 'aging', 'no update', 'stuck'],
  blockers: ['blocker', 'blockers', 'blocked', 'impediment'],
  sprint: ['sprint', 'iteration'],
  full: ['analyze', 'analysis', 'report', 'status', 'health'],
};

/**
 * Free-text analysis request parser (Slack, Jira comment, agent message body).
 * Resolves: squad + intent + optional portable scope (assignee, issue keys, …).
 */
export function parseSlackRequest(text: string, config: EmCopilotConfig): ParsedSlackRequest {
  const rawText = text.trim();
  const lower = rawText.toLowerCase();

  const squad = resolveSquad(lower, config);
  if (!squad) {
    return {
      kind: 'unknownSquad',
      rawText,
      message: `Unknown squad. Configured squads: ${config.squads.map((s) => s.displayName).join(', ')}`,
      configuredSquads: config.squads.map((s) => ({
        displayName: s.displayName,
        aliases: s.aliases ?? [],
      })),
    };
  }

  const intent = resolveIntent(lower);
  if (!intent) {
    return {
      kind: 'unknownIntent',
      rawText,
      message:
        'Could not determine analysis intent. Try: analyze, blockers, stale, hygiene, sprint, or follow-up.',
      supportedIntents: [...INTENTS],
    };
  }

  const scope = parseScopeFromText(rawText, squad.squad);

  return {
    kind: 'analysis',
    rawText,
    normalizedSquadToken: squad.token,
    squadId: squad.squad.id,
    squadDisplayName: squad.squad.displayName,
    intent,
    scope: Object.keys(scope).length ? scope : undefined,
  } satisfies ParsedAnalysisRequest;
}

function resolveSquad(
  lower: string,
  config: EmCopilotConfig,
): { squad: EmCopilotConfig['squads'][0]; token: string } | null {
  // Longer tokens first (avoid partial alias collisions)
  const ranked: { squad: EmCopilotConfig['squads'][0]; token: string }[] = [];
  for (const squad of config.squads) {
    const tokens = [squad.displayName.toLowerCase(), ...(squad.aliases ?? []).map((a) => a.toLowerCase())];
    for (const token of tokens) {
      ranked.push({ squad, token });
    }
  }
  ranked.sort((a, b) => b.token.length - a.token.length);

  for (const entry of ranked) {
    if (lower.includes(entry.token)) {
      return entry;
    }
  }
  return null;
}

function resolveIntent(lower: string): ParsedAnalysisRequest['intent'] | null {
  for (const intent of INTENTS) {
    for (const keyword of INTENT_KEYWORDS[intent]) {
      if (lower.includes(keyword)) {
        return intent;
      }
    }
  }
  if (lower.includes('squad') || lower.includes('team') || lower.includes('ticket')) {
    return 'full';
  }
  return null;
}
