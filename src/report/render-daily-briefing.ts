import type { DailyTwoSquadBriefing } from '../contracts/daily-briefing.js';
import type { ContextualAnalysis } from '../contracts/contextual-analysis.js';
import { formatReportTimestamp } from '../lib/datetime.js';
import { renderDataLimitations, emptySectionMessage } from './sections.js';
import { formatGroupedDrafts } from './group-drafts.js';
import { capList, overflowLine } from './sections.js';

export function renderDailyBriefing(
  briefing: DailyTwoSquadBriefing,
  contextual?: ContextualAnalysis,
): string {
  const lines: string[] = [];
  const refreshLabel = briefing.isRefresh ? ' (Refresh)' : '';

  lines.push(`## Daily Manager Briefing — ${briefing.reportDate}${refreshLabel}`);
  lines.push(`_${formatReportTimestamp(briefing.timezone)}_`);
  lines.push('');

  lines.push('### Squad Status');
  for (const s of briefing.squadSummaries) {
    lines.push(`• **${s.displayName}**: ${s.oneLineStatus} — _${s.healthStatus}_`);
  }
  lines.push('');

  lines.push('### Cross-Squad Priorities');
  const crossCapped = capList(briefing.crossSquadPriorities);
  if (crossCapped.items.length) {
    for (const p of crossCapped.items) {
      lines.push(`• **${p.kind}**: ${p.summary} (${p.issueKeys.slice(0, 3).join(', ')})`);
    }
    const overflow = overflowLine(crossCapped.overflow, 'priorities');
    if (overflow) lines.push(overflow);
  } else {
    lines.push(emptySectionMessage('cross-squad priorities'));
  }
  lines.push('');

  for (const squad of briefing.perSquadFindings) {
    if (squad.unavailable) {
      lines.push(`### ${squad.squadId} — Unavailable`);
      lines.push(`_${squad.unavailableReason ?? 'Data fetch failed'}_`);
      lines.push('');
      continue;
    }

    const f = squad.findings;
    lines.push(`### ${squad.squadId} — Top Risks`);
    const risks = capList(f.deliveryRisks);
    if (risks.items.length) {
      lines.push(risks.items.map((r) => `• ${r.issueKeys.join(', ')}: ${r.impact}`).join('\n'));
    } else {
      lines.push(emptySectionMessage('risks'));
    }
    lines.push('');
  }

  const focusItems = contextual?.standUpFocusItems ?? briefing.standUpFocusItems;
  lines.push('### Stand-Up Focus');
  if (focusItems?.length) {
    for (const item of focusItems) {
      lines.push(`• **${item.squadId}**: ${item.focus}`);
    }
  } else {
    lines.push('_Stand-up focus will appear when contextual analysis is provided._');
  }
  lines.push('');

  const drafts = contextual?.followUpDrafts ?? briefing.followUpDrafts;
  if (drafts?.length) {
    lines.push('### Follow-Up Drafts (Manager Review Only)');
    lines.push(formatGroupedDrafts(drafts, 20));
    lines.push('');
  }

  const limitations = renderDataLimitations(briefing.limitations);
  if (limitations.length) {
    lines.push('### Data Limitations');
    lines.push(limitations.join('\n'));
  }

  if (!briefing.isRefresh) {
    lines.push('');
    lines.push('_First run today — no comparison to prior briefing._');
  }

  return lines.join('\n');
}

export function buildDailyBriefingAggregate(input: {
  generatedAt: string;
  timezone: string;
  reportDate: string;
  isRefresh: boolean;
  squadSummaries: DailyTwoSquadBriefing['squadSummaries'];
  crossSquadPriorities: DailyTwoSquadBriefing['crossSquadPriorities'];
  perSquadFindings: DailyTwoSquadBriefing['perSquadFindings'];
  limitations: DailyTwoSquadBriefing['limitations'];
  standUpFocusItems?: DailyTwoSquadBriefing['standUpFocusItems'];
  followUpDrafts?: DailyTwoSquadBriefing['followUpDrafts'];
}): DailyTwoSquadBriefing {
  return {
    generatedAt: input.generatedAt,
    timezone: input.timezone,
    reportDate: input.reportDate,
    isRefresh: input.isRefresh,
    squadSummaries: input.squadSummaries,
    crossSquadPriorities: input.crossSquadPriorities,
    perSquadFindings: input.perSquadFindings,
    limitations: input.limitations,
    standUpFocusItems: input.standUpFocusItems,
    followUpDrafts: input.followUpDrafts?.slice(0, 20),
  };
}
