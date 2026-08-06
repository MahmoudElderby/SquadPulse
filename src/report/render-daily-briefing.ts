import type { DailyTwoSquadBriefing } from '../contracts/daily-briefing.js';
import type { ContextualAnalysis } from '../contracts/contextual-analysis.js';
import type { DeterministicFindings } from '../contracts/deterministic-findings.js';
import type { NormalizedSquadSnapshot } from '../contracts/normalized-squad-snapshot.js';
import { formatReportTimestamp } from '../lib/datetime.js';
import { renderDataLimitations, emptySectionMessage, capList, overflowLine } from './sections.js';
import { formatGroupedDrafts } from './group-drafts.js';
import {
  indexWorkItems,
  formatRiskBlock,
  formatActionLine,
  cleanLimitations,
  keyTitleLine,
} from './issue-context.js';

/** Optional per-squad snapshots so titles/owners resolve in daily output. */
export type SnapshotBySquadId = Record<string, NormalizedSquadSnapshot>;

export function renderDailyBriefing(
  briefing: DailyTwoSquadBriefing,
  contextual?: ContextualAnalysis,
  snapshotsBySquad?: SnapshotBySquadId,
): string {
  const lines: string[] = [];
  const refreshLabel = briefing.isRefresh ? ' (Refresh)' : '';

  lines.push(`*Daily briefing — ${briefing.reportDate}${refreshLabel}*`);
  lines.push(`_${formatReportTimestamp(briefing.timezone)}_`);
  lines.push('');

  lines.push('*Squad status*');
  for (const s of briefing.squadSummaries) {
    lines.push(`• *${s.displayName}*: ${s.healthStatus} — ${s.oneLineStatus}`);
  }
  lines.push('');

  // Unified "needs you today" from both squads
  lines.push('*What needs you today*');
  const allActions = collectActions(briefing, snapshotsBySquad);
  if (allActions.length) {
    lines.push(allActions.slice(0, 8).join('\n'));
    if (allActions.length > 8) {
      lines.push(`_+${allActions.length - 8} more actions not shown_`);
    }
  } else {
    lines.push('_No urgent manager actions across squads._');
  }
  lines.push('');

  lines.push('*Cross-squad*');
  const crossCapped = capList(briefing.crossSquadPriorities);
  if (crossCapped.items.length) {
    for (const p of crossCapped.items) {
      const keyBits = p.issueKeys
        .slice(0, 3)
        .map((k) => {
          const map = mapForKey(k, snapshotsBySquad);
          return map ? keyTitleLine(k, map) : `\`${k}\``;
        })
        .join('; ');
      lines.push(`• ${p.summary}${keyBits ? `\n  ${keyBits}` : ''}`);
    }
    const overflow = overflowLine(crossCapped.overflow, 'priorities');
    if (overflow) lines.push(overflow);
  } else {
    lines.push(emptySectionMessage('cross-squad priorities'));
  }
  lines.push('');

  for (const squad of briefing.perSquadFindings) {
    const display =
      briefing.squadSummaries.find((s) => s.squadId === squad.squadId)?.displayName ?? squad.squadId;

    if (squad.unavailable) {
      lines.push(`*${display} — unavailable*`);
      lines.push(`_${squad.unavailableReason ?? 'Data fetch failed'}_`);
      lines.push('');
      continue;
    }

    const f = squad.findings;
    const map = snapshotsBySquad?.[squad.squadId]
      ? indexWorkItems(snapshotsBySquad[squad.squadId])
      : new Map();

    lines.push(`*${display} — top risks*`);
    const risks = capList(f.deliveryRisks, 3);
    if (risks.items.length) {
      for (let i = 0; i < risks.items.length; i++) {
        lines.push(...formatRiskBlock(risks.items[i], map, i + 1));
      }
      const overflow = overflowLine(risks.overflow, 'risks');
      if (overflow) lines.push(overflow);
    } else {
      lines.push(emptySectionMessage('risks'));
    }
    lines.push('');
  }

  const focusItems = contextual?.standUpFocusItems ?? briefing.standUpFocusItems;
  lines.push('*Stand-up focus*');
  if (focusItems?.length) {
    for (const item of focusItems) {
      const name =
        briefing.squadSummaries.find((s) => s.squadId === item.squadId)?.displayName ?? item.squadId;
      lines.push(`• *${name}*: ${item.focus}`);
    }
  } else {
    lines.push('_Add stand-up focus via contextual analysis, or use “What needs you today” above._');
  }
  lines.push('');

  const drafts = contextual?.followUpDrafts ?? briefing.followUpDrafts;
  if (drafts?.length) {
    lines.push('*Follow-up drafts* (manager review only)');
    lines.push(formatGroupedDrafts(drafts, 20));
    lines.push('');
  }

  const limitations = renderDataLimitations(cleanLimitations(briefing.limitations));
  if (limitations.length) {
    lines.push('*Data notes*');
    lines.push(limitations.join('\n'));
  }

  if (!briefing.isRefresh) {
    lines.push('');
    lines.push('_First run today — no comparison to a prior briefing._');
  }

  return lines.join('\n').trim() + '\n';
}

function collectActions(
  briefing: DailyTwoSquadBriefing,
  snapshotsBySquad?: SnapshotBySquadId,
): string[] {
  const lines: string[] = [];
  let n = 1;
  for (const squad of briefing.perSquadFindings) {
    if (squad.unavailable || !squad.findings) continue;
    const map = snapshotsBySquad?.[squad.squadId]
      ? indexWorkItems(snapshotsBySquad[squad.squadId])
      : new Map();
    const display =
      briefing.squadSummaries.find((s) => s.squadId === squad.squadId)?.displayName ?? squad.squadId;
    for (const a of squad.findings.managerActions.slice(0, 4)) {
      const renumbered = { ...a, priority: n++ };
      lines.push(`[${display}] ${formatActionLine(renumbered, map)}`);
    }
  }
  return lines;
}

function mapForKey(key: string, snapshotsBySquad?: SnapshotBySquadId) {
  if (!snapshotsBySquad) return null;
  for (const snap of Object.values(snapshotsBySquad)) {
    const map = indexWorkItems(snap);
    if (map.has(key)) return map;
  }
  return null;
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

export type { DeterministicFindings };
