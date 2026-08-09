import { cycleReplySummarySchema } from '../contracts/reply-summary.js';

export function validateReplySummary(raw: unknown) {
  return cycleReplySummarySchema.parse(raw);
}
