import { DateTime, Interval } from 'luxon';

export function getTimezone(configTz?: string): string {
  return configTz ?? 'UTC';
}

export function nowInTimezone(tz: string): DateTime {
  return DateTime.now().setZone(tz);
}

export function formatReportTimestamp(tz: string): string {
  const dt = nowInTimezone(tz);
  if (!dt.isValid) {
    return DateTime.utc().toFormat("yyyy-MM-dd HH:mm 'UTC'");
  }
  // Prefer offset name/offset over abbreviated zone token, which can render oddly
  return dt.toFormat('yyyy-MM-dd HH:mm ZZZZ');
}

export function formatReportDate(tz: string): string {
  return nowInTimezone(tz).toISODate() ?? '';
}

export function isWorkingDay(tz: string, workingDays: number[]): boolean {
  const now = nowInTimezone(tz);
  return workingDays.includes(now.weekday);
}

export function businessDaysBetween(start: DateTime, end: DateTime, workingDays: number[]): number {
  if (end < start) return 0;
  let count = 0;
  let cursor = start.startOf('day');
  const endDay = end.startOf('day');
  while (cursor <= endDay) {
    if (workingDays.includes(cursor.weekday)) {
      count++;
    }
    cursor = cursor.plus({ days: 1 });
  }
  return Math.max(0, count - 1);
}

export function sprintElapsedFraction(
  startDate?: string,
  endDate?: string,
  now?: DateTime,
): number | undefined {
  if (!startDate || !endDate) return undefined;
  const start = DateTime.fromISO(startDate);
  const end = DateTime.fromISO(endDate);
  const current = now ?? DateTime.now();
  if (!start.isValid || !end.isValid) return undefined;
  const interval = Interval.fromDateTimes(start, end);
  const total = interval.length('milliseconds');
  if (total <= 0) return undefined;
  const elapsed = Math.max(0, current.toMillis() - start.toMillis());
  return Math.min(1, elapsed / total);
}

export function parseTimeHHmm(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map(Number);
  return { hour: h, minute: m };
}
