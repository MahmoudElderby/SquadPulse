import type { ReportIntent } from './render-squad-report.js';

export function filterFindingsByIntent<T extends { category?: string }>(
  items: T[],
  intent: ReportIntent,
  categories: string[],
): T[] {
  if (intent === 'full') return items;
  return items.filter((item) => item.category && categories.includes(item.category));
}

export function sectionsForIntent(intent: ReportIntent): string[] {
  switch (intent) {
    case 'blockers':
      return ['health', 'blockers', 'risks-blockers'];
    case 'hygiene':
      return ['hygiene'];
    case 'stale':
      return ['health', 'risks-stale'];
    case 'sprint':
      return ['health', 'keyFacts', 'risks', 'blockers'];
    case 'follow-up':
      return ['health', 'drafts'];
    default:
      return ['all'];
  }
}
