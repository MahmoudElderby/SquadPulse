import type { FollowUpCycle } from '../contracts/follow-up-cycle.js';

function renderCommandGuide(proposalCount: number): string[] {
  const lines: string[] = [
    '*How to respond*',
    'Reply in this thread with plain text (no buttons). Use the proposal numbers shown above.',
    '',
  ];

  if (proposalCount === 0) {
    lines.push('• Run `analyze <squad>` for a fresh analysis, then `followups <squad>` again.');
    lines.push('• Reply `done` to close this cycle.');
    return lines;
  }

  const examples = Math.min(proposalCount, 2);
  lines.push('*Step 1 — pick proposals*');
  lines.push(`• \`approve 1\` — send proposal 1`);
  if (examples >= 2) {
    lines.push('• `approve 1, 2` — send proposals 1 and 2');
  }
  lines.push('• `approve all` — send every proposal');
  lines.push(`• \`ignore 1\` — skip proposal 1 (no DM sent)`);
  lines.push('');
  lines.push('*Step 2 — edit before sending (optional)*');
  lines.push(
    '• `edit 1: Could you share a quick update on blockers?` — replace the draft, then run `approve 1`',
  );
  lines.push('');
  lines.push('*Step 3 — after DMs are sent*');
  lines.push('• `status` — refresh reply summary from engineers');
  lines.push('• `draft another 1` — ask a follow-up on proposal 1 (needs approval again)');
  lines.push('• `done` — close this cycle when you are finished');

  return lines;
}

export function renderCyclePreview(cycle: FollowUpCycle): string {
  const lines: string[] = [];
  const { analysisConsumed, proposals } = cycle;

  lines.push(`*Follow-up proposals — ${cycle.squadId}*`);
  lines.push(
    `Analysis from ${analysisConsumed.analyzedAt}${analysisConsumed.possiblyStale ? ' _(possibly stale)_' : ''}`,
  );
  lines.push('');

  if (proposals.length === 0) {
    lines.push('No follow-up proposals generated from the current analysis.');
    lines.push('Run `analyze <squad>` if you need a fresh analysis, or check data limitations below.');
  } else {
    for (const p of proposals) {
      lines.push(`*${p.index}.* ${p.issueKey} → ${p.engineerDisplayName}`);
      lines.push(`   Reason: ${p.reasonType.replace(/-/g, ' ')}`);
      lines.push(`   Confidence: ${p.confidence} | Urgency: ${p.urgency}`);
      lines.push(`   Draft: ${p.editedMessage ?? p.draftMessage}`);
      lines.push(`   Evidence: ${p.evidence.map((e) => e.summary).join('; ')}`);
      lines.push('');
    }
  }

  lines.push(...renderCommandGuide(proposals.length));

  const limitations = cycle.dataLimitations ?? [];
  if (cycle.overflowCount && cycle.overflowCount > 0) {
    limitations.push({
      scope: 'proposal cap',
      reason: `${cycle.overflowCount} additional candidate(s) not shown`,
    });
  }

  if (limitations.length) {
    lines.push('');
    lines.push('*Data limitations:*');
    for (const lim of limitations) {
      lines.push(`• ${lim.scope}: ${lim.reason}`);
    }
  }

  return lines.join('\n');
}

export function renderZeroProposalsMessage(squadDisplayName: string): string {
  return `No follow-up proposals for ${squadDisplayName}. The latest analysis had no mappable findings, or all candidates were skipped. Try \`analyze ${squadDisplayName}\` for a fresh run.`;
}

export function renderCommandHelp(): string {
  return [
    'Could not parse that command. Reply in this thread with plain text, for example:',
    '• `approve 1` or `approve 1, 2` or `approve all`',
    '• `edit 1: Your revised message here` then `approve 1`',
    '• `ignore 1` · `status` · `draft another 1` · `done`',
  ].join('\n');
}
