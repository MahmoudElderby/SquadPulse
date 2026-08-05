export const LIST_CAP = 5;

export interface CappedListResult<T> {
  items: T[];
  total: number;
  overflow: number;
}

export function capList<T>(items: T[], cap = LIST_CAP): CappedListResult<T> {
  return {
    items: items.slice(0, cap),
    total: items.length,
    overflow: Math.max(0, items.length - cap),
  };
}

export function overflowLine(overflow: number, label: string): string | null {
  if (overflow <= 0) return null;
  return `_+${overflow} more ${label} not shown_`;
}

export function renderDataLimitations(
  limitations: { scope: string; reason: string }[] | undefined,
): string[] {
  if (!limitations?.length) return [];
  return limitations.map((l) => `• **${l.scope}**: ${l.reason}`);
}

export function emptySectionMessage(sectionName: string): string {
  return `_No ${sectionName} identified in current data._`;
}
