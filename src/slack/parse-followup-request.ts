import type { EmCopilotConfig } from '../contracts/config.js';
import type { ParsedFollowUpSlackRequest } from '../contracts/follow-up-slack-request.js';
import { SUPPORTED_FOLLOWUP_COMMANDS } from '../contracts/follow-up-slack-request.js';

// Include singular "followup" / "follow-up" — managers often omit the trailing "s".
const FOLLOWUP_INTENT_KEYWORDS = ['followups', 'follow-ups', 'follow ups', 'followup', 'follow-up'];

function resolveSquad(
  lower: string,
  config: EmCopilotConfig,
): { squad: EmCopilotConfig['squads'][0]; token: string } | null {
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

function hasFollowupIntent(lower: string): boolean {
  return FOLLOWUP_INTENT_KEYWORDS.some((kw) => lower.includes(kw));
}

function parseIndexes(raw: string): number[] {
  return raw
    .split(/[, ]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n) && n >= 1);
}

/** True when text is a manager command during an active follow-up poll loop. */
export function isFollowUpManagerCommand(text: string): boolean {
  const rawText = text.trim();
  if (/^approve\s+all\b/i.test(rawText)) return true;
  if (/^approve\s+[\d,\s]+$/i.test(rawText)) return true;
  if (/^edit\s+\d+\s*:/is.test(rawText)) return true;
  if (/^ignore\s+\d+$/i.test(rawText)) return true;
  if (/^draft\s+another\s+\d+$/i.test(rawText)) return true;
  if (/^status\b/i.test(rawText)) return true;
  if (/^(done|close cycle)\b/i.test(rawText)) return true;
  return false;
}

export function parseFollowUpRequest(text: string, config: EmCopilotConfig): ParsedFollowUpSlackRequest {
  const rawText = text.trim();
  const lower = rawText.toLowerCase().replace(/\s+/g, ' ');

  if (hasFollowupIntent(lower)) {
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
    return {
      kind: 'startCycle',
      rawText,
      squadId: squad.squad.id,
      squadDisplayName: squad.squad.displayName,
    };
  }

  if (/^approve\s+all\b/i.test(rawText)) {
    return { kind: 'approveAll', rawText };
  }

  const approveMatch = rawText.match(/^approve\s+([\d,\s]+)$/i);
  if (approveMatch) {
    return { kind: 'approve', rawText, proposalIndexes: parseIndexes(approveMatch[1]!) };
  }

  const editMatch = rawText.match(/^edit\s+(\d+)\s*:\s*(.+)$/is);
  if (editMatch) {
    return {
      kind: 'edit',
      rawText,
      proposalIndexes: [parseInt(editMatch[1]!, 10)],
      editedText: editMatch[2]!.trim(),
    };
  }

  const ignoreMatch = rawText.match(/^ignore\s+(\d+)$/i);
  if (ignoreMatch) {
    return { kind: 'ignore', rawText, proposalIndexes: [parseInt(ignoreMatch[1]!, 10)] };
  }

  const draftAnotherMatch = rawText.match(/^draft\s+another\s+(\d+)$/i);
  if (draftAnotherMatch) {
    return { kind: 'draftAnother', rawText, proposalIndexes: [parseInt(draftAnotherMatch[1]!, 10)] };
  }

  if (/^status\b/i.test(rawText)) {
    return { kind: 'status', rawText };
  }

  if (/^(done|close cycle)\b/i.test(rawText)) {
    return { kind: 'closeCycle', rawText };
  }

  if (/^(approve|edit|ignore|draft)\b/i.test(rawText)) {
    return {
      kind: 'unknownCommand',
      rawText,
      message: 'Could not parse that command. Supported forms: ' + SUPPORTED_FOLLOWUP_COMMANDS.join('; '),
      supportedCommands: [...SUPPORTED_FOLLOWUP_COMMANDS],
    };
  }

  return {
    kind: 'unknownCommand',
    rawText,
    message: 'Unrecognized follow-up command.',
    supportedCommands: [...SUPPORTED_FOLLOWUP_COMMANDS],
  };
}
