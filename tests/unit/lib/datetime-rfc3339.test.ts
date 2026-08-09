import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { toRfc3339DateTime } from '../../../src/lib/datetime.js';

describe('toRfc3339DateTime', () => {
  const dt = z.string().datetime();

  it('converts Jira offset without colon to UTC ISO', () => {
    const result = toRfc3339DateTime('2026-08-09T14:16:00.292+0300');
    expect(result).toBeDefined();
    expect(dt.safeParse(result).success).toBe(true);
    expect(result).toBe('2026-08-09T11:16:00.292Z');
  });

  it('passes through Zulu timestamps', () => {
    expect(toRfc3339DateTime('2026-08-09T11:16:00.292Z')).toBe('2026-08-09T11:16:00.292Z');
  });

  it('returns undefined for empty input', () => {
    expect(toRfc3339DateTime(undefined)).toBeUndefined();
    expect(toRfc3339DateTime(null)).toBeUndefined();
    expect(toRfc3339DateTime('')).toBeUndefined();
  });
});
