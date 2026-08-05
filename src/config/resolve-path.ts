import { existsSync } from 'node:fs';

/** Prefer local config/em-copilot.yml when present; else the committed example. */
export function resolveConfigPath(explicit?: string): string {
  if (explicit) return explicit;
  if (existsSync('config/em-copilot.yml')) return 'config/em-copilot.yml';
  return 'config/em-copilot.example.yml';
}
