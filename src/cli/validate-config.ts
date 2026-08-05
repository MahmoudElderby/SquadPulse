#!/usr/bin/env node
import { loadConfigRaw } from '../config/load.js';
import { validateConfig } from '../config/validate.js';
import { exitWithRunResult } from '../lib/run-result.js';

import { resolveConfigPath } from '../config/resolve-path.js';

const configPath = resolveConfigPath(process.argv[2]);

try {
  const raw = loadConfigRaw(configPath);
  const result = validateConfig(raw);

  if (!result.valid) {
    console.error('Configuration validation failed:');
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    exitWithRunResult({
      status: 'error',
      workflow: 'on-demand',
      slackDelivered: false,
      failureReason: 'CONFIG_INVALID',
    });
  }

  const squads = result.config!.squads.map((s) => s.displayName).join(', ');
  console.log(`Configuration valid: ${result.config!.squads.length} squads (${squads})`);
  console.log('Aliases are unique; each squad has at least one board configured.');
  process.exit(0);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
