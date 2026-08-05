import type { DeterministicFindings } from '../contracts/deterministic-findings.js';
import type { ContextualAnalysis } from '../contracts/contextual-analysis.js';
import type { NormalizedSquadSnapshot } from '../contracts/normalized-squad-snapshot.js';
import { capList, overflowLine, renderDataLimitations, emptySectionMessage } from './sections.js';
import { formatReportTimestamp } from '../lib/datetime.js';

export type ReportIntent = 'full' | 'sprint' | 'blockers' | 'stale' | 'hygiene' | 'follow-up';

export interface SquadReportOptions {
  snapshot: NormalizedSquadSnapshot;
  findings: DeterministicFindings;
  contextual?: ContextualAnalysis;
  intent?: ReportIntent;
  includeDrafts?: boolean;
}

export function renderSquadReport(options: SquadReportOptions): string {
  const { snapshot, findings, contextual, intent = 'full', includeDrafts = false } = options;
  const sections: string[] = [];
  const tz = snapshot.timezone;

  sections.push(`## ${snapshot.displayName} Squad Report`);
  sections.push(`_${formatReportTimestamp(tz)}_`);
  sections.push('');

  if (intent === 'full' || intent === 'sprint') {
    sections.push(`### Overall Health: **${findings.health.status}**`);
    if (findings.health.reasons.length) {
      sections.push(findings.health.reasons.map((r) => `• ${r}`).join('\n'));
    }
    sections.push('');
  }

  if (intent === 'full' || intent === 'sprint') {
    sections.push('### Key Facts');
    const facts = [...(findings.keyFacts ?? []), ...(contextual?.keyFactsNarrative ?? [])];
    if (facts.length) {
      sections.push(facts.map((f) => `• ${f}`).join('\n'));
    } else {
      sections.push(emptySectionMessage('key facts'));
    }

    const hasScrum = snapshot.workItems.some((w) => w.boardType === 'scrum');
    const hasKanban = snapshot.workItems.some((w) => w.boardType === 'kanban');
    if (hasScrum && hasKanban) {
      sections.push('• Mixed board types: Scrum sprint scope + Kanban flow items');
    }
    if (hasScrum && !snapshot.activeSprint) {
      sections.push('• _No active sprint detected; sprint timing rules may not apply._');
    }
    sections.push('');
  }

  if (intent === 'full' || intent === 'blockers' || intent === 'stale') {
    sections.push('### Delivery Risks');
    let risks = findings.deliveryRisks;
    if (intent === 'stale') {
      risks = risks.filter((r) => r.category === 'staleInProgress' || r.category === 'noRecentUpdate');
    }
    const capped = capList(risks);
    if (capped.items.length) {
      for (const risk of capped.items) {
        sections.push(`• **${risk.category}** (${risk.issueKeys.join(', ')})`);
        sections.push(`  ${risk.impact}`);
        sections.push(`  _Action:_ ${risk.recommendedAction}`);
      }
      const overflow = overflowLine(capped.overflow, 'risks');
      if (overflow) sections.push(overflow);
    } else {
      sections.push(emptySectionMessage('delivery risks'));
    }
    sections.push('');
  }

  if (intent === 'full' || intent === 'blockers') {
    sections.push('### Blockers & Dependencies');
    const capped = capList(findings.blockers);
    if (capped.items.length) {
      for (const b of capped.items) {
        const owned = b.isOwned ? 'owned' : 'unowned';
        sections.push(`• **${b.issueKey}** (${owned})${b.blockedByKeys?.length ? ` blocked by ${b.blockedByKeys.join(', ')}` : ''}`);
      }
      const overflow = overflowLine(capped.overflow, 'blockers');
      if (overflow) sections.push(overflow);
    } else {
      sections.push(emptySectionMessage('blockers'));
    }
    sections.push('');
  }

  if (intent === 'full') {
    sections.push('### Flow Signals');
    const capped = capList(findings.flowSignals);
    if (capped.items.length) {
      sections.push(capped.items.map((s) => `• ${s.description}`).join('\n'));
      const overflow = overflowLine(capped.overflow, 'signals');
      if (overflow) sections.push(overflow);
    } else {
      sections.push(emptySectionMessage('flow signals'));
    }
    sections.push('');
  }

  if (intent === 'full' || intent === 'hygiene') {
    sections.push('### Jira Hygiene');
    const capped = capList(findings.hygieneFindings);
    if (capped.items.length) {
      for (const h of capped.items) {
        sections.push(`• **${h.issueKey}** (${h.category}): ${h.evidence}`);
      }
      const overflow = overflowLine(capped.overflow, 'hygiene items');
      if (overflow) sections.push(overflow);
    } else {
      sections.push(emptySectionMessage('hygiene findings'));
    }
    sections.push('');
  }

  if (intent === 'full') {
    sections.push('### Prioritized Manager Actions');
    const capped = capList(findings.managerActions);
    if (capped.items.length) {
      sections.push(capped.items.map((a) => `${a.priority}. ${a.action} (${a.relatedIssueKeys.join(', ')})`).join('\n'));
    } else {
      sections.push(emptySectionMessage('manager actions'));
    }
    sections.push('');
  }

  if ((intent === 'full' || intent === 'follow-up') && includeDrafts && contextual?.followUpDrafts.length) {
    sections.push('### Follow-Up Drafts (Manager Review Only)');
    sections.push(formatDraftsSection(contextual.followUpDrafts, 10));
    sections.push('');
  }

  const limitations = renderDataLimitations(findings.limitations);
  if (limitations.length) {
    sections.push('### Data Limitations');
    sections.push(limitations.join('\n'));
  }

  return sections.join('\n');
}

function formatDraftsSection(
  drafts: ContextualAnalysis['followUpDrafts'],
  max: number,
): string {
  const capped = capList(drafts, max);
  const lines: string[] = [];
  const grouped = groupByRecipient(capped.items);

  for (const [recipient, items] of Object.entries(grouped)) {
    lines.push(`**${recipient}**`);
    for (const d of items) {
      lines.push(`• _${d.draftType}_ — ${d.issueKeys.join(', ')}`);
      lines.push(`  ${d.observation}`);
      lines.push(`  _Request:_ ${d.request}`);
    }
  }

  const overflow = overflowLine(capped.overflow, 'drafts');
  if (overflow) lines.push(overflow);
  return lines.join('\n');
}

function groupByRecipient(drafts: ContextualAnalysis['followUpDrafts']): Record<string, typeof drafts> {
  const result: Record<string, typeof drafts> = {};
  for (const d of drafts) {
    result[d.recipientDisplayName] = result[d.recipientDisplayName] ?? [];
    result[d.recipientDisplayName].push(d);
  }
  return result;
}

export { groupByRecipient };
