import type { SquadConfig } from '../contracts/config.js';
import type { AnalysisScope } from '../contracts/analysis-scope.js';
import { isScopeActive } from '../contracts/analysis-scope.js';
import type { NormalizedSquadSnapshot, WorkItem } from '../contracts/normalized-squad-snapshot.js';

/** Jira-style keys: PROJECT-123 */
const ISSUE_KEY_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/g;

/**
 * Free-text patterns for person focus (Slack / Jira comment style).
 * Groups: 1 = name
 */
const ASSIGNEE_PATTERNS: RegExp[] = [
  /\bfocus(?:ed)?\s+on\s+([A-Za-z][A-Za-z.'\- ]{1,80}?)(?:\s+tickets?|\s+issues?|\s+items?)?(?:\s*$|[.,;]|and\s)/i,
  /\bonly\s+([A-Za-z][A-Za-z.'\- ]{1,80}?)(?:\s+tickets?|\s+issues?)(?:\s|$)/i,
  /\b(?:for|about)\s+([A-Za-z][A-Za-z.'\- ]{1,80}?)(?:\s+tickets?|\s+issues?|\s+s\b)(?:\s|$)/i,
  /\b(?:assignee|assigned\s+to|owned\s+by|owner)\s*[:=]?\s*([A-Za-z][A-Za-z.'\- ]{1,80}?)(?:\s|$|[.,;])/i,
  /\btickets?\s+(?:for|of)\s+([A-Za-z][A-Za-z.'\- ]{1,80}?)(?:\s|$)/i,
];

const STOP_SQUAD_WORDS = new Set([
  'squad',
  'team',
  'orion',
  'cobra',
  'storefront',
  'payments',
  'analyze',
  'analysis',
  'report',
  'status',
  'health',
  'blockers',
  'blocker',
  'hygiene',
  'stale',
  'sprint',
  'tickets',
  'ticket',
  'issues',
  'issue',
  'items',
  'item',
  'work',
  'the',
  'a',
  'an',
]);

/**
 * Parse a portable AnalysisScope from free text (Slack message, Jira comment, agent prompt).
 * Transport-agnostic: same function can power Slack CLI and future Jira-triggered runs.
 */
export function parseScopeFromText(text: string, squad?: SquadConfig): AnalysisScope {
  const focusNotes: string[] = [];
  const issueKeys = extractIssueKeys(text);
  if (issueKeys.length) {
    focusNotes.push(`issue keys: ${issueKeys.join(', ')}`);
  }

  const assignees = extractAssignees(text, squad);
  if (assignees.length) {
    focusNotes.push(`assignees: ${assignees.join(', ')}`);
  }

  const scope: AnalysisScope = {};
  if (issueKeys.length) scope.issueKeys = issueKeys;
  if (assignees.length) scope.assignees = assignees;
  if (focusNotes.length) scope.focusNotes = focusNotes;
  return scope;
}

/**
 * Structured scope (JSON / API). Merges with optional free-text for hybrid prompts.
 */
export function resolveScope(input: {
  structured?: AnalysisScope | null;
  text?: string;
  squad?: SquadConfig;
}): AnalysisScope {
  const fromText = input.text ? parseScopeFromText(input.text, input.squad) : {};
  const fromJson = input.structured ?? {};
  return mergeScopes(fromJson, fromText);
}

export function mergeScopes(a: AnalysisScope, b: AnalysisScope): AnalysisScope {
  const issueKeys = unique([...(a.issueKeys ?? []), ...(b.issueKeys ?? [])]);
  const assignees = unique([...(a.assignees ?? []), ...(b.assignees ?? [])]);
  const labels = unique([...(a.labels ?? []), ...(b.labels ?? [])]);
  const focusNotes = unique([...(a.focusNotes ?? []), ...(b.focusNotes ?? [])]);
  return {
    ...(issueKeys.length ? { issueKeys } : {}),
    ...(assignees.length ? { assignees } : {}),
    ...(labels.length ? { labels } : {}),
    ...(focusNotes.length ? { focusNotes } : {}),
  };
}

/**
 * Apply scope filters to a squad snapshot before analysis.
 * Dimensions use AND (all must match when present).
 */
export function applyScopeToSnapshot(
  snapshot: NormalizedSquadSnapshot,
  scope: AnalysisScope | undefined,
): { snapshot: NormalizedSquadSnapshot; applied: boolean; matched: number; notes: string[] } {
  if (!isScopeActive(scope) || !scope) {
    return { snapshot, applied: false, matched: snapshot.workItems.length, notes: [] };
  }

  const notes: string[] = [];
  let items = snapshot.workItems;

  if (scope.issueKeys?.length) {
    const keySet = new Set(scope.issueKeys.map((k) => k.toUpperCase()));
    items = items.filter((w) => keySet.has(w.key.toUpperCase()));
    notes.push(`Filtered to issue keys: ${scope.issueKeys.join(', ')} (${items.length} match)`);
  }

  if (scope.assignees?.length) {
    const before = items.length;
    items = items.filter((w) => matchesAnyAssignee(w, scope.assignees!));
    notes.push(
      `Filtered to assignee(s) [${scope.assignees.join(', ')}]: ${items.length} of ${before} remaining`,
    );
  }

  if (scope.labels?.length) {
    const before = items.length;
    const wanted = scope.labels.map((l) => l.toLowerCase());
    items = items.filter((w) =>
      (w.labels ?? []).some((lab) => wanted.some((want) => lab.toLowerCase().includes(want))),
    );
    notes.push(`Filtered to labels [${scope.labels.join(', ')}]: ${items.length} of ${before} remaining`);
  }

  const limitations = [
    ...(snapshot.limitations ?? []),
    ...notes.map((reason) => ({
      scope: `${snapshot.displayName} / request scope`,
      reason,
    })),
  ];

  if (items.length === 0) {
    limitations.push({
      scope: `${snapshot.displayName} / request scope`,
      reason:
        'Scope matched 0 work items in the squad snapshot. Broaden names/keys or drop the filter. Analysis reflects empty scope, not full squad health.',
    });
  }

  return {
    applied: true,
    matched: items.length,
    notes,
    snapshot: {
      ...snapshot,
      workItems: items,
      retrievalMeta: {
        ...snapshot.retrievalMeta,
        issueCount: items.length,
      },
      limitations,
    },
  };
}

function extractIssueKeys(text: string): string[] {
  const keys: string[] = [];
  const re = new RegExp(ISSUE_KEY_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    keys.push(m[1].toUpperCase());
  }
  return unique(keys);
}

function extractAssignees(text: string, squad?: SquadConfig): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();

  // Prefer configured team names (longest match first)
  const known = Object.keys(squad?.teamMemberSlackMap ?? {}).sort((a, b) => b.length - a.length);
  for (const name of known) {
    if (lower.includes(name.toLowerCase())) {
      found.push(name);
    }
  }
  if (found.length) return unique(found);

  for (const re of ASSIGNEE_PATTERNS) {
    const m = text.match(re);
    if (m?.[1]) {
      const cleaned = cleanPersonName(m[1]);
      if (cleaned && !STOP_SQUAD_WORDS.has(cleaned.toLowerCase())) {
        found.push(cleaned);
      }
    }
  }
  return unique(found);
}

function cleanPersonName(raw: string): string {
  return raw
    .replace(/\b(tickets?|issues?|items?|work|analysis|report)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^A-Za-z]+|[^A-Za-z.']+$/g, '')
    .trim();
}

function matchesAnyAssignee(item: WorkItem, assignees: string[]): boolean {
  const name = item.assigneeDisplayName?.toLowerCase() ?? '';
  if (!name) return false;
  return assignees.some((a) => {
    const q = a.toLowerCase().trim();
    return name === q || name.includes(q) || q.includes(name);
  });
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}
