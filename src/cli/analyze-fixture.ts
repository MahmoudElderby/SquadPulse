#!/usr/bin/env node
import { loadConfig } from '../config/load.js';
import { validateConfig } from '../config/validate.js';
import { resolveConfigPath } from '../config/resolve-path.js';
import { analyzeSnapshot } from '../analysis/engine.js';
import { renderSquadReport } from '../report/render-squad-report.js';
import { loadFixtureSnapshot } from '../lib/fixture-mode.js';
import { deterministicFindingsSchema } from '../contracts/deterministic-findings.js';
import { readFileSync, existsSync } from 'node:fs';
import { validateContextualAnalysis } from '../ai/validate-contextual.js';
import { mergeContextualAnalysis } from '../ai/merge-contextual.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const squadIdx = args.indexOf('--squad');
  const intentIdx = args.indexOf('--intent');
  const configIdx = args.indexOf('--config');
  return {
    squad: squadIdx >= 0 ? args[squadIdx + 1] : 'storefront',
    intent: (intentIdx >= 0 ? args[intentIdx + 1] : 'full') as
      | 'full'
      | 'follow-up'
      | 'hygiene'
      | 'blockers'
      | 'stale'
      | 'sprint',
    includeDrafts: args.includes('--include-drafts'),
    configPath: resolveConfigPath(configIdx >= 0 ? args[configIdx + 1] : undefined),
  };
}

const { squad, intent, includeDrafts, configPath } = parseArgs();

const raw = loadConfig(configPath);
const validation = validateConfig(raw);
if (!validation.valid || !validation.config) {
  console.error('Invalid config');
  process.exit(1);
}

const config = validation.config;
const squadConfig = config.squads.find((s) => s.id === squad);
if (!squadConfig) {
  console.error(`Unknown squad: ${squad}`);
  process.exit(1);
}

const snapshot = loadFixtureSnapshot(squad);
const findings = analyzeSnapshot(snapshot, squadConfig);
deterministicFindingsSchema.parse(findings);

let contextual;
const contextualPath = `fixtures/ai/sample-contextual-analysis.json`;
if (includeDrafts && existsSync(contextualPath)) {
  contextual = validateContextualAnalysis(JSON.parse(readFileSync(contextualPath, 'utf-8')));
  mergeContextualAnalysis(findings, contextual);
}

const report = renderSquadReport({
  snapshot,
  findings,
  contextual,
  intent,
  includeDrafts,
});

console.log(JSON.stringify({ findings, report }, null, 2));
