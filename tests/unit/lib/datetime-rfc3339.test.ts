import { describe, expect, it } from 'vitest';
import { toRfc3339DateTime } from '../../../src/lib/datetime.js';

describe('toRfc3339DateTime', () => {
  it('normalizes Jira offsets without a colon', () => {
    expect(toRfc3339DateTime('2026-08-09T15:44:47.422+0300')).toBe('2026-08-09T12:44:47.422Z');
  });

  it('passes through already-valid RFC 3339 UTC timestamps', () => {
    expect(toRfc3339DateTime('2026-08-09T12:44:47.422Z')).toBe('2026-08-09T12:44:47.422Z');
  });

  it('returns undefined for empty or invalid input', () => {
    expect(toRfc3339DateTime(undefined)).toBeUndefined();
    expect(toRfc3339DateTime('')).toBeUndefined();
    expect(toRfc3339DateTime('not-a-date')).toBeUndefined();
  });
});
