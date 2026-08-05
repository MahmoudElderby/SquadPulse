import { describe, it, expect } from 'vitest';
import { validateConfig } from '../../../src/config/validate.js';
import { loadConfigRaw } from '../../../src/config/load.js';

describe('config validation', () => {
  it('validates example config successfully', () => {
    const raw = loadConfigRaw('config/em-copilot.example.yml');
    const result = validateConfig(raw);
    expect(result.valid).toBe(true);
    expect(result.config?.squads).toHaveLength(2);
  });

  it('rejects overlapping aliases across squads', () => {
    const raw = loadConfigRaw('config/em-copilot.example.yml') as Record<string, unknown>;
    const squads = (raw.squads as Record<string, unknown>[]).map((s) => ({ ...s }));
    squads[1].aliases = ['store', 'billing'];
    const result = validateConfig({ ...raw, squads });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Alias'))).toBe(true);
  });

  it('rejects squad with no board IDs', () => {
    const raw = loadConfigRaw('config/em-copilot.example.yml') as Record<string, unknown>;
    const squads = (raw.squads as Record<string, unknown>[]).map((s) => ({ ...s }));
    delete squads[0].scrumBoardId;
    delete squads[0].kanbanBoardId;
    const result = validateConfig({ ...raw, squads });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('scrumBoardId') || e.includes('kanbanBoardId'))).toBe(true);
  });

  it('returns actionable error messages', () => {
    const raw = loadConfigRaw('config/em-copilot.example.yml') as Record<string, unknown>;
    const squads = (raw.squads as Record<string, unknown>[]).map((s) => ({ ...s }));
    delete squads[0].scrumBoardId;
    delete squads[0].kanbanBoardId;
    const result = validateConfig({ ...raw, squads });
    expect(result.errors[0]).toMatch(/Storefront|storefront/);
  });
});
