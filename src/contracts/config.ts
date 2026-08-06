import { z } from 'zod';

const statusCategoryMappingSchema = z.object({
  notStarted: z.array(z.string()),
  inProgress: z.array(z.string()),
  blocked: z.array(z.string()),
  reviewOrHandoff: z.array(z.string()),
  done: z.array(z.string()),
});

const priorityMappingSchema = z.object({
  P0: z.array(z.string()),
  P1: z.array(z.string()),
  P2: z.array(z.string()),
  P3: z.array(z.string()),
  P4: z.array(z.string()),
});

const squadSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    displayName: z.string().min(1),
    aliases: z.array(z.string().min(1)).optional(),
    projectKeys: z.array(z.string().min(1)).min(1),
    /** Board "Filter query" from Jira board settings (ORDER BY is stripped at runtime). */
    boardFilterJql: z.string().min(1).optional(),
    scrumBoardId: z.number().int().min(1).optional(),
    kanbanBoardId: z.number().int().min(1).optional(),
    statusCategories: statusCategoryMappingSchema,
    priorityMapping: priorityMappingSchema,
    blockerFieldId: z.string().optional(),
    dependencyLinkTypes: z.array(z.string()).optional(),
    teamMemberSlackMap: z.record(z.string()).optional(),
    thresholds: z
      .object({
        staleInProgressBusinessDays: z.number().min(1).default(5),
        noMeaningfulUpdateBusinessDays: z.number().min(1).default(3),
        maxInProgressPerPerson: z.number().min(1).default(3),
      })
      .optional(),
    schedule: z
      .object({
        timezone: z.string().optional(),
        workingDays: z.array(z.number().int().min(1).max(7)).optional(),
      })
      .optional(),
  })
  .refine((s) => s.scrumBoardId !== undefined || s.kanbanBoardId !== undefined, {
    message: 'At least one of scrumBoardId or kanbanBoardId is required',
  });

export const emCopilotConfigSchema = z.object({
  jira: z.object({
    baseUrl: z.string().url(),
  }),
  slack: z.object({
    managerDestination: z.string().regex(/^[CGD][A-Z0-9]+$/),
    onDemandReplyInThread: z.boolean().default(true),
  }),
  schedule: z
    .object({
      timezone: z.string().default('UTC'),
      workingDays: z.array(z.number().int().min(1).max(7)).default([1, 2, 3, 4, 5]),
      dailyBriefingTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .default('08:30'),
    })
    .optional(),
  secrets: z
    .object({
      envVarNames: z
        .object({
          jiraBaseUrl: z.string().default('JIRA_BASE_URL'),
          jiraEmail: z.string().default('JIRA_EMAIL'),
          jiraApiToken: z.string().default('JIRA_API_TOKEN'),
          slackBotToken: z.string().default('SLACK_BOT_TOKEN'),
        })
        .optional(),
    })
    .optional(),
  squads: z.array(squadSchema).length(2),
});

export type EmCopilotConfig = z.infer<typeof emCopilotConfigSchema>;
export type SquadConfig = z.infer<typeof squadSchema>;
