import { describe, it, expect } from 'vitest';
import { checkScheduleGuard } from '../../../src/lib/schedule-guard.js';
import { loadConfig } from '../../../src/config/load.js';

const config = loadConfig('config/em-copilot.example.yml');

describe('schedule guard', () => {
  it('allows run on working day with force flag', () => {
    const result = checkScheduleGuard(config, { force: true });
    expect(result.shouldRun).toBe(true);
  });

  it('uses configured timezone', () => {
    const result = checkScheduleGuard(config, { force: true });
    expect(result.timezone).toBe('America/New_York');
  });

  it('skips on non-working day without force', () => {
    const weekendConfig = {
      ...config,
      schedule: { ...config.schedule, workingDays: [6, 7] },
    };
    const result = checkScheduleGuard(weekendConfig, {});
    expect(result.shouldRun).toBe(false);
    expect(result.reason).toContain('working day');
  });

  it('defaults to Mon-Fri schedule from example config', () => {
    expect(config.schedule?.workingDays).toEqual([1, 2, 3, 4, 5]);
    expect(config.schedule?.dailyBriefingTime).toBe('08:30');
  });
});
