import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

describe('followups-cycle dry-run', () => {
  it('generates numbered preview with fixture mode', () => {
    const output = execSync(
      'npm run followups:cycle -- --text "followups Orion" --fixture --dry-run --config fixtures/config/followups-orion.yml',
      { encoding: 'utf-8', cwd: process.cwd() },
    );

    expect(output).toContain('Follow-up proposals');
    expect(output).toContain('MTN-101');
    expect(output).toContain('approve');
    expect(output).toContain('"workflow": "followups"');
    expect(output).toContain('"proposalsGenerated"');
  });
});
