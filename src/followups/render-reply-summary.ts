import type { CycleReplySummary } from '../contracts/reply-summary.js';

export function renderReplySummary(summary: CycleReplySummary): string {
  const lines: string[] = ['*Reply summary*'];

  if (summary.groupedByEngineer.length === 0) {
    lines.push('No sent messages to summarize yet. Approve and send proposals first.');
    return lines.join('\n');
  }

  for (const group of summary.groupedByEngineer) {
    lines.push('');
    lines.push(`*${group.engineerDisplayName}*`);
    for (const item of group.items) {
      lines.push(`• ${item.issueKey}: ${item.extraction}`);
      lines.push(`  Recommendation: ${item.recommendation} (${item.readStatus})`);
    }
  }

  if (summary.dataLimitations?.length) {
    lines.push('');
    lines.push('*Data limitations:*');
    for (const lim of summary.dataLimitations) {
      lines.push(`• ${lim.scope}: ${lim.reason}`);
    }
  }

  return lines.join('\n');
}
