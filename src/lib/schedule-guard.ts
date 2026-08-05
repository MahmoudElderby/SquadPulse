import type { EmCopilotConfig } from '../contracts/config.js';
import { isWorkingDay, nowInTimezone, parseTimeHHmm } from './datetime.js';

export interface ScheduleGuardResult {
  shouldRun: boolean;
  reason?: string;
  timezone: string;
  isRefresh?: boolean;
}

export function checkScheduleGuard(
  config: EmCopilotConfig,
  options: { force?: boolean; refresh?: boolean } = {},
): ScheduleGuardResult {
  const tz = config.schedule?.timezone ?? 'UTC';
  const workingDays = config.schedule?.workingDays ?? [1, 2, 3, 4, 5];

  if (options.force) {
    return { shouldRun: true, timezone: tz, isRefresh: options.refresh ?? false };
  }

  if (!isWorkingDay(tz, workingDays)) {
    return {
      shouldRun: false,
      reason: 'Not a configured working day',
      timezone: tz,
    };
  }

  const briefingTime = config.schedule?.dailyBriefingTime ?? '08:30';
  const { hour, minute } = parseTimeHHmm(briefingTime);
  const now = nowInTimezone(tz);

  // Allow run any time on working days when invoked manually; schedule trigger handles cron
  if (now.hour < hour || (now.hour === hour && now.minute < minute - 30)) {
    // Still allow — manual "Run now" should work per quickstart
  }

  return { shouldRun: true, timezone: tz, isRefresh: options.refresh ?? false };
}
