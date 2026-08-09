import { z } from 'zod';

const configuredSquadSchema = z.object({
  displayName: z.string(),
  aliases: z.array(z.string()),
});

export const parsedFollowUpSlackRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('startCycle'),
    rawText: z.string().optional(),
    squadId: z.string(),
    squadDisplayName: z.string(),
  }),
  z.object({
    kind: z.enum(['approve', 'edit', 'ignore', 'approveAll', 'status', 'draftAnother', 'closeCycle']),
    rawText: z.string().optional(),
    proposalIndexes: z.array(z.number().int().min(1)).optional(),
    editedText: z.string().optional(),
  }),
  z.object({
    kind: z.enum(['unknownSquad', 'unknownCommand', 'noActiveCycle', 'ambiguousSquad']),
    rawText: z.string().optional(),
    message: z.string(),
    configuredSquads: z.array(configuredSquadSchema).optional(),
    supportedCommands: z.array(z.string()).optional(),
  }),
]);

export type ParsedFollowUpSlackRequest = z.infer<typeof parsedFollowUpSlackRequestSchema>;

export const SUPPORTED_FOLLOWUP_COMMANDS = [
  'approve <n>',
  'approve <n,m,...>',
  'approve all',
  'edit <n>: <text>',
  'ignore <n>',
  'status',
  'draft another <n>',
  'done',
  'close cycle',
] as const;
