import { readFileSync } from 'node:fs';
import { contextualAnalysisSchema, type ContextualAnalysis } from '../contracts/contextual-analysis.js';

export function validateContextualAnalysis(raw: unknown): ContextualAnalysis {
  return contextualAnalysisSchema.parse(raw);
}

export function validateContextualFile(path: string): ContextualAnalysis {
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  return validateContextualAnalysis(raw);
}
