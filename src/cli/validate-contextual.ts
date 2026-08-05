#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { validateContextualFile } from '../ai/validate-contextual.js';

function parseArgs(): { file?: string } {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  return { file: fileIdx >= 0 ? args[fileIdx + 1] : undefined };
}

const { file } = parseArgs();

if (!file) {
  console.error('Usage: npm run validate:contextual -- --file <path>');
  process.exit(1);
}

try {
  const validated = validateContextualFile(file);
  console.log(`Valid contextual analysis: ${validated.followUpDrafts.length} draft(s)`);
  process.exit(0);
} catch (err) {
  console.error('Validation failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
