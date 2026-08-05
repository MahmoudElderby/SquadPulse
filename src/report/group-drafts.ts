import type { FollowUpDraft } from '../contracts/contextual-analysis.js';
import { capList, overflowLine } from './sections.js';

export function groupDraftsByRecipient(
  drafts: FollowUpDraft[],
): Map<string, FollowUpDraft[]> {
  const map = new Map<string, FollowUpDraft[]>();
  for (const draft of drafts) {
    const list = map.get(draft.recipientDisplayName) ?? [];
    list.push(draft);
    map.set(draft.recipientDisplayName, list);
  }
  return map;
}

export function formatGroupedDrafts(drafts: FollowUpDraft[], max = 10): string {
  const capped = capList(drafts, max);
  const grouped = groupDraftsByRecipient(capped.items);
  const lines: string[] = [];

  for (const [recipient, items] of grouped) {
    lines.push(`**To: ${recipient}**`);
    for (const d of items) {
      const tone = d.draftType;
      lines.push(`• [${tone}] ${d.issueKeys.join(', ')}: ${d.observation}`);
      lines.push(`  _Ask:_ ${d.request}`);
    }
  }

  const overflow = overflowLine(capped.overflow, 'drafts');
  if (overflow) lines.push(overflow);
  return lines.join('\n');
}
