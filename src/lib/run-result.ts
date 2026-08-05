import { runResultSchema, type RunResult } from '../contracts/run-result.js';

export function buildRunResult(result: RunResult): RunResult {
  return runResultSchema.parse(result);
}

export function emitRunResult(result: RunResult): void {
  const validated = buildRunResult(result);
  console.log(JSON.stringify(validated, null, 2));
}

export function exitWithRunResult(result: RunResult): never {
  emitRunResult(result);
  process.exit(result.status === 'error' ? 1 : 0);
}
