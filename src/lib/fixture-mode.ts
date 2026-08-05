import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { normalizedSquadSnapshotSchema, type NormalizedSquadSnapshot } from '../contracts/normalized-squad-snapshot.js';

export function loadFixtureSnapshot(squadId: string, fixturesDir = 'fixtures/jira'): NormalizedSquadSnapshot {
  const candidates = [
    join(fixturesDir, `${squadId}-sprint-active.json`),
    join(fixturesDir, `${squadId}-mixed-boards.json`),
    join(fixturesDir, `${squadId}.json`),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      const raw = JSON.parse(readFileSync(path, 'utf-8'));
      return normalizedSquadSnapshotSchema.parse(raw);
    }
  }

  throw new Error(`No fixture found for squad "${squadId}" in ${fixturesDir}`);
}

export function isFixtureMode(args: string[]): boolean {
  return args.includes('--fixture');
}

export function getFixtureSquadId(args: string[]): string | undefined {
  const idx = args.indexOf('--squad');
  return idx >= 0 ? args[idx + 1] : undefined;
}
