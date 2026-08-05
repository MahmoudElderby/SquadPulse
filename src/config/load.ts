import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { emCopilotConfigSchema, type EmCopilotConfig } from '../contracts/config.js';

export function loadConfig(path: string): EmCopilotConfig {
  const raw = readFileSync(path, 'utf-8');
  const parsed = parseYaml(raw);
  return emCopilotConfigSchema.parse(parsed);
}

export function loadConfigRaw(path: string): unknown {
  const raw = readFileSync(path, 'utf-8');
  return parseYaml(raw);
}
