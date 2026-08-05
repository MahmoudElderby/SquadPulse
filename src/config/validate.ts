import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { emCopilotConfigSchema, type EmCopilotConfig } from '../contracts/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  config?: EmCopilotConfig;
}

function loadJsonSchema(): object {
  const schemaPath = join(__dirname, '../../config/em-copilot.schema.json');
  return JSON.parse(readFileSync(schemaPath, 'utf-8')) as object;
}

function checkAliasOverlap(config: EmCopilotConfig): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();

  for (const squad of config.squads) {
    const tokens = [squad.displayName.toLowerCase(), ...(squad.aliases ?? []).map((a) => a.toLowerCase())];
    for (const token of tokens) {
      const existing = seen.get(token);
      if (existing && existing !== squad.id) {
        errors.push(
          `Alias "${token}" is used by both squad "${existing}" and squad "${squad.id}". Aliases must be unique across squads.`,
        );
      } else {
        seen.set(token, squad.id);
      }
    }
  }
  return errors;
}

function checkBoardPresence(config: EmCopilotConfig): string[] {
  const errors: string[] = [];
  for (const squad of config.squads) {
    if (!squad.scrumBoardId && !squad.kanbanBoardId) {
      errors.push(
        `Squad "${squad.displayName}" (${squad.id}) must have at least one of scrumBoardId or kanbanBoardId configured.`,
      );
    }
  }
  return errors;
}

export function validateConfig(raw: unknown): ValidationResult {
  const errors: string[] = [];

  // Semantic checks on squads even when schema fails (actionable squad names)
  if (typeof raw === 'object' && raw !== null && Array.isArray((raw as { squads?: unknown }).squads)) {
    for (const squad of (raw as { squads: Record<string, unknown>[] }).squads) {
      const id = String(squad.id ?? 'unknown');
      const name = String(squad.displayName ?? id);
      if (!squad.scrumBoardId && !squad.kanbanBoardId) {
        errors.push(
          `Squad "${name}" (${id}) must have at least one of scrumBoardId or kanbanBoardId configured.`,
        );
      }
    }
    if (errors.length > 0) {
      return { valid: false, errors };
    }
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = loadJsonSchema();
  const validate = ajv.compile(schema);

  if (!validate(raw)) {
    for (const err of validate.errors ?? []) {
      errors.push(`${err.instancePath || '/'}: ${err.message}`);
    }
    return { valid: false, errors };
  }

  const zodResult = emCopilotConfigSchema.safeParse(raw);
  if (!zodResult.success) {
    for (const issue of zodResult.error.issues) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    }
    return { valid: false, errors };
  }

  const config = zodResult.data;
  errors.push(...checkAliasOverlap(config), ...checkBoardPresence(config));

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], config };
}
