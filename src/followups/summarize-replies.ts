import type { ReplyRecommendation, CycleReplySummary } from '../contracts/reply-summary.js';
import type { ApprovedMessageDelivery } from '../contracts/follow-up-cycle.js';
import type { FollowUpProposal } from '../contracts/follow-up-proposal.js';
import type { EngineerReplyMessage } from '../slack/dm-deliver.js';

export interface ClassifiedReply {
  issueKey: string;
  engineerDisplayName: string;
  extraction: string;
  blockerSignal?: string;
  recommendation: ReplyRecommendation;
  readStatus: 'read' | 'no reply yet within cycle window' | 'unreadable';
  unreadableReason?: string;
  rawText?: string;
}

const BLOCKER_PHRASES = [
  /\bblock(ed|er|ing)\b/i,
  /\bwaiting on\b/i,
  /\bdependency\b/i,
  /\bcannot proceed\b/i,
];

const ETA_PATTERNS = [
  /\b(eta|by|tomorrow|today|eod|end of day)\b/i,
  /\b\d{1,2}\/\d{1,2}\b/,
  /\b(monday|tuesday|wednesday|thursday|friday)\b/i,
];

const NOT_STARTED_PHRASES = [/\bnot started\b/i, /\bhaven't started\b/i, /\bno progress\b/i];

const PROGRESS_OK_PHRASES = [
  /\bon track\b/i,
  /\balmost done\b/i,
  /\bcompleted\b/i,
  /\bmerged\b/i,
  /\bready for review\b/i,
];

function isEmojiOnly(text: string): boolean {
  const stripped = text.replace(/[\s\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');
  return stripped.length === 0 && text.trim().length > 0;
}

function neutralizeHrAdjacent(text: string): string {
  return text
    .replace(/\b(personal|family|health|medical)\b/gi, '[personal matter]')
    .trim();
}

export function classifyReplyText(text: string): {
  extraction: string;
  blockerSignal?: string;
  recommendation: ReplyRecommendation;
} {
  const trimmed = text.trim();
  if (!trimmed || isEmojiOnly(trimmed)) {
    return {
      extraction: 'no on-topic content extracted',
      recommendation: 'another follow-up suggested (draft on request)',
    };
  }

  const neutral = neutralizeHrAdjacent(trimmed);

  for (const pattern of BLOCKER_PHRASES) {
    if (pattern.test(neutral)) {
      return {
        extraction: neutral.slice(0, 200),
        blockerSignal: pattern.source,
        recommendation: 'manager attention recommended',
      };
    }
  }

  for (const pattern of NOT_STARTED_PHRASES) {
    if (pattern.test(neutral)) {
      return {
        extraction: neutral.slice(0, 200),
        recommendation: 'another follow-up suggested (draft on request)',
      };
    }
  }

  for (const pattern of PROGRESS_OK_PHRASES) {
    if (pattern.test(neutral)) {
      return {
        extraction: neutral.slice(0, 200),
        recommendation: 'no further follow-up needed',
      };
    }
  }

  if (ETA_PATTERNS.some((p) => p.test(neutral))) {
    return {
      extraction: neutral.slice(0, 200),
      recommendation: 'no further follow-up needed',
    };
  }

  return {
    extraction: neutral.slice(0, 200),
    recommendation: 'another follow-up suggested (draft on request)',
  };
}

export function summarizeReplies(
  proposals: FollowUpProposal[],
  deliveries: ApprovedMessageDelivery[],
  repliesByIndex: Map<number, EngineerReplyMessage[]>,
): ClassifiedReply[] {
  const results: ClassifiedReply[] = [];

  for (const delivery of deliveries) {
    if (delivery.deliveryStatus !== 'sent') continue;

    const proposal = proposals.find((p) => p.index === delivery.proposalIndex);
    if (!proposal) continue;

    const replies = repliesByIndex.get(delivery.proposalIndex) ?? [];
    if (replies.length === 0) {
      results.push({
        issueKey: proposal.issueKey,
        engineerDisplayName: proposal.engineerDisplayName,
        extraction: 'no reply yet within cycle window',
        recommendation: 'another follow-up suggested (draft on request)',
        readStatus: 'no reply yet within cycle window',
      });
      continue;
    }

    const latest = replies[replies.length - 1]!;
    if (!latest.text?.trim()) {
      results.push({
        issueKey: proposal.issueKey,
        engineerDisplayName: proposal.engineerDisplayName,
        extraction: 'unreadable reply',
        recommendation: 'manager attention recommended',
        readStatus: 'unreadable',
        unreadableReason: 'empty message body',
        rawText: latest.text,
      });
      continue;
    }

    const classified = classifyReplyText(latest.text);
    results.push({
      issueKey: proposal.issueKey,
      engineerDisplayName: proposal.engineerDisplayName,
      ...classified,
      readStatus: 'read',
      rawText: latest.text,
    });
  }

  return results;
}

export function buildCycleReplySummary(classified: ClassifiedReply[]): CycleReplySummary {
  const byEngineer = new Map<string, ClassifiedReply[]>();
  for (const item of classified) {
    const list = byEngineer.get(item.engineerDisplayName) ?? [];
    list.push(item);
    byEngineer.set(item.engineerDisplayName, list);
  }

  return {
    groupedByEngineer: [...byEngineer.entries()].map(([engineerDisplayName, items]) => ({
      engineerDisplayName,
      items: items.map((i) => ({
        issueKey: i.issueKey,
        extraction: i.extraction,
        blockerSignal: i.blockerSignal,
        recommendation: i.recommendation,
        readStatus: i.readStatus,
        unreadableReason: i.unreadableReason,
      })),
    })),
  };
}
