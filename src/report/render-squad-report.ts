import type { DeterministicFindings } from '../contracts/deterministic-findings.js';
import type { ContextualAnalysis } from '../contracts/contextual-analysis.js';
import type { NormalizedSquadSnapshot } from '../contracts/normalized-squad-snapshot.js';
import { capList, overflowLine, renderDataLimitations, emptySectionMessage } from './sections.js';
import { formatReportTimestamp } from '../lib/datetime.js';
import {
  indexWorkItems,
  formatRiskBlock,
  formatBlockerLine,
  formatMergedHygiene,
  formatFlowLine,
  formatActionLine,
  cleanLimitations,
  riskLabel,
  keyTitleLine,
} from './issue-context.js';

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
  const map = indexWorkItems(snapshot);

  // Header
  sections.push(`*${snapshot.displayName} Squad — ${findings.health.status}*`);
  sections.push(buildSubheader(snapshot, findings));
  sections.push(`_${formatReportTimestamp(tz)}_`);
  sections.push('');

  if (intent === 'full' || intent === 'sprint') {
    sections.push('*Why this status*');
    if (findings.health.reasons.length) {
      sections.push(findings.health.reasons.map((r) => `• ${r}`).join('\n'));
    } else if (findings.health.status === 'On Track') {
      sections.push('• No material delivery risks requiring manager intervention');
    } else {
      sections.push('• See risks below');
    }
    sections.push('');
  }

  if (intent === 'full' || intent === 'sprint' || intent === 'follow-up') {
    sections.push('*What needs you today*');
    const actions = capList(findings.managerActions, 5);
    if (actions.items.length) {
      sections.push(actions.items.map((a) => formatActionLine(a, map)).join('\n'));
      const overflow = overflowLine(actions.overflow, 'actions');
      if (overflow) sections.push(overflow);
    } else {
      sections.push('_Nothing urgent identified — review hygiene only if time allows._');
    }
    sections.push('');
  }

  if (intent === 'full' || intent === 'blockers' || intent === 'stale') {
    sections.push('*Risks* (by impact)');
    let risks = findings.deliveryRisks;
    if (intent === 'stale') {
      risks = risks.filter((r) => r.category === 'staleInProgress' || r.category === 'noRecentUpdate');
    }
    const capped = capList(risks);
    if (capped.items.length) {
      for (let i = 0; i < capped.items.length; i++) {
        sections.push(...formatRiskBlock(capped.items[i], map, i + 1));
      }
      const overflow = overflowLine(capped.overflow, 'risks');
      if (overflow) sections.push(overflow);
    } else {
      sections.push(emptySectionMessage('delivery risks'));
    }
    sections.push('');
  }

  if (intent === 'full' || intent === 'blockers') {
    sections.push('*Blockers*');
    const capped = capList(findings.blockers);
    if (capped.items.length) {
      for (let i = 0; i < capped.items.length; i++) {
        sections.push(...formatBlockerLine(capped.items[i], map, i + 1));
      }
      const overflow = overflowLine(capped.overflow, 'blockers');
      if (overflow) sections.push(overflow);
    } else {
      sections.push(emptySectionMessage('blockers'));
    }
    sections.push('');
  }

  if (intent === 'full') {
    sections.push('*Flow* (process signals, not performance)');
    const capped = capList(findings.flowSignals);
    if (capped.items.length) {
      sections.push(capped.items.map((s) => formatFlowLine(s, map)).join('\n'));
      const overflow = overflowLine(capped.overflow, 'signals');
      if (overflow) sections.push(overflow);
    } else {
      sections.push(emptySectionMessage('flow signals'));
    }
    sections.push('');
  }

  if (intent === 'full' || intent === 'hygiene') {
    sections.push('*Jira hygiene* (process cleanup — does not by itself put sprint at risk)');
    const merged = formatMergedHygiene(findings.hygieneFindings, map, 5);
    if (merged.lines.length) {
      sections.push(merged.lines.join('\n'));
      if (merged.overflow > 0) {
        sections.push(`_+${merged.overflow} more hygiene issues not shown_`);
      }
    } else {
      sections.push(emptySectionMessage('hygiene findings'));
    }
    sections.push('');
  }

  if ((intent === 'full' || intent === 'follow-up') && includeDrafts && contextual?.followUpDrafts.length) {
    sections.push('*Follow-up drafts* (manager review only — not sent)');
    sections.push(formatDraftsSection(contextual.followUpDrafts, map, 10));
    sections.push('');
  }

  // Snapshot facts (compact, end of brief or after header for intent sprint)
  if (intent === 'full' || intent === 'sprint') {
    sections.push('*Snapshot*');
    const facts = [...(findings.keyFacts ?? [])];
    if (facts.length) {
      sections.push(facts.map((f) => `• ${f}`).join('\n'));
    }
    if (!snapshot.activeSprint && snapshot.workItems.some((w) => w.boardType === 'scrum')) {
      sections.push('• _No active sprint detected; sprint timing rules may not apply._');
    }
    if (contextual?.keyFactsNarrative?.length) {
      sections.push(contextual.keyFactsNarrative.map((f) => `• ${f}`).join('\n'));
    }
    sections.push('');
  }

  const limitations = renderDataLimitations(cleanLimitations(findings.limitations));
  if (limitations.length) {
    sections.push('*Data notes*');
    sections.push(limitations.join('\n'));
  }

  return sections.join('\n').trim() + '\n';
}

function buildSubheader(snapshot: NormalizedSquadSnapshot, findings: DeterministicFindings): string {
  const parts: string[] = [];
  if (snapshot.activeSprint?.name) {
    parts.push(snapshot.activeSprint.name);
    if (snapshot.activeSprint.elapsedFraction != null) {
      parts.push(`${Math.round(snapshot.activeSprint.elapsedFraction * 100)}% elapsed`);
    }
  }
  const total = snapshot.workItems.length;
  const inProg = snapshot.workItems.filter((w) => w.statusCategory === 'inProgress').length;
  const blocked = snapshot.workItems.filter((w) => w.statusCategory === 'blocked').length;
  parts.push(`${total} items in scope`);
  parts.push(`${inProg} in progress`);
  parts.push(`${blocked} blocked`);
  if (findings.deliveryRisks.length) {
    parts.push(`${findings.deliveryRisks.length} delivery risk${findings.deliveryRisks.length === 1 ? '' : 's'}`);
  }
  return `_${parts.join(' · ')}_`;
}

function formatDraftsSection(
  drafts: ContextualAnalysis['followUpDrafts'],
  map: Map<string, import('../contracts/normalized-squad-snapshot.js').WorkItem>,
  max: number,
): string {
  const capped = capList(drafts, max);
  const lines: string[] = [];
  const grouped = groupByRecipient(capped.items);

  for (const [recipient, items] of Object.entries(grouped)) {
    lines.push(`*${recipient}*`);
    for (const d of items) {
      const titles = d.issueKeys.map((k) => keyTitleLine(k, map)).join('; ');
      lines.push(`• _${d.draftType}_ — ${titles}`);
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

export { groupByRecipient, riskLabel };
