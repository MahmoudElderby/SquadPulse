#!/usr/bin/env node
import { loadConfigRaw } from '../config/load.js';
import { validateConfig } from '../config/validate.js';
import { resolveSecrets } from '../config/secrets.js';
import { resolveConfigPath } from '../config/resolve-path.js';
import { resolveCommunicationAssistant } from '../contracts/config.js';
import { isFollowUpManagerCommand, parseFollowUpRequest } from '../slack/parse-followup-request.js';
import { loadSquadAnalysisArtifact } from '../followups/load-artifact.js';
import { mapFindingsToProposals } from '../followups/map-findings-to-proposals.js';
import { composeProposalDrafts, buildContinuationDraft } from '../followups/compose-proposal-drafts.js';
import { createFollowUpCycle, recordSentDelivery, addContinuationProposal, recordCapturedReply } from '../followups/cycle-state.js';
import { renderCyclePreview, renderZeroProposalsMessage } from '../followups/render-cycle-preview.js';
import { processManagerCommand, getApprovedPendingSend } from '../followups/process-manager-command.js';
import { renderDeliverySummary, countDeliveryStats } from '../followups/render-delivery-summary.js';
import { summarizeReplies, buildCycleReplySummary } from '../followups/summarize-replies.js';
import { renderReplySummary } from '../followups/render-reply-summary.js';
import { postSlackMessage, dryRunPost, SlackPostError } from '../slack/post-message.js';
import { createSlackClient, deliverDirectMessage, readDmReplies } from '../slack/dm-deliver.js';
import { pollThreadOnce, sleepMs, pollDeadline, isPastDeadline } from '../slack/poll-thread.js';
import { isFixtureMode } from '../lib/fixture-mode.js';
import { followUpRunResultSchema } from '../contracts/follow-up-run-result.js';
import type { FollowUpCycle } from '../contracts/follow-up-cycle.js';
import type { FollowUpProposal } from '../contracts/follow-up-proposal.js';
import { readFileSync, existsSync } from 'node:fs';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  return {
    text: get('--text') ?? '',
    slackChannel: get('--slack-channel'),
    threadTs: get('--thread-ts') ?? '0',
    fixture: isFixtureMode(args),
    dryRun: args.includes('--dry-run'),
    poll: args.includes('--poll'),
    configPath: resolveConfigPath(get('--config')),
    artifactFixture: get('--artifact-fixture'),
    commandTranscript: get('--command-transcript'),
  };
}

function emitFollowUpResult(result: Parameters<typeof followUpRunResultSchema.parse>[0]): never {
  const validated = followUpRunResultSchema.parse(result);
  console.log(JSON.stringify(validated, null, 2));
  process.exit(result.status === 'error' ? 1 : 0);
}

async function postManagerMessage(
  text: string,
  opts: ReturnType<typeof parseArgs>,
  secrets: ReturnType<typeof resolveSecrets>,
): Promise<{ slackDelivered: boolean; messageTs?: string }> {
  if (opts.dryRun || !opts.slackChannel || !secrets.slackBotToken) {
    dryRunPost(text);
    console.log(text);
    return { slackDelivered: false };
  }
  const result = await postSlackMessage({
    secrets,
    channel: opts.slackChannel,
    text,
    threadTs: opts.threadTs,
  });
  return { slackDelivered: true, messageTs: result.ts };
}

async function sendApprovedProposals(
  cycle: FollowUpCycle,
  proposals: FollowUpProposal[],
  opts: ReturnType<typeof parseArgs>,
  secrets: ReturnType<typeof resolveSecrets>,
  config: ReturnType<typeof validateConfig>['config'],
): Promise<FollowUpCycle> {
  let updated = { ...cycle };
  const client = opts.dryRun || !secrets.slackBotToken ? null : createSlackClient(secrets);

  for (const proposal of proposals) {
    if (proposal.status !== 'approved') continue;

    const finalText = proposal.editedMessage ?? proposal.draftMessage;
    let deliveryStatus: 'sent' | 'failed' | 'skipped' = 'failed';
    let failureReason: string | undefined;
    let dmChannelId: string | undefined;
    let sentMessageTs: string | undefined;
    let recipientSlackUserId = proposal.slackUserId;

    if (!proposal.slackUserId) {
      deliveryStatus = 'skipped';
      failureReason = 'missing recipient mapping';
    } else if (opts.dryRun || !client) {
      deliveryStatus = 'sent';
      dmChannelId = 'D_FIXTURE';
      sentMessageTs = `${Date.now()}.000000`;
    } else {
      const result = await deliverDirectMessage(client, proposal.slackUserId, finalText);
      if (result.skipped) {
        deliveryStatus = 'skipped';
        failureReason = result.error;
      } else if (result.ok) {
        deliveryStatus = 'sent';
        dmChannelId = result.dmChannelId;
        sentMessageTs = result.sentMessageTs;
      } else {
        deliveryStatus = 'failed';
        failureReason = result.error;
      }
    }

    updated = recordSentDelivery(
      updated,
      {
        proposalIndex: proposal.index,
        finalMessageText: finalText,
        recipientSlackUserId,
        dmChannelId,
        sentMessageTs,
        deliveryStatus,
        failureReason,
      },
      proposal,
    );

    const newStatus =
      deliveryStatus === 'sent' ? 'sent' : deliveryStatus === 'skipped' ? 'skipped' : 'failed';
    updated = {
      ...updated,
      proposals: updated.proposals.map((p) =>
        p.index === proposal.index ? { ...p, status: newStatus } : p,
      ),
    };
  }

  return updated;
}

async function handleStatus(
  cycle: FollowUpCycle,
  opts: ReturnType<typeof parseArgs>,
  secrets: ReturnType<typeof resolveSecrets>,
  config: NonNullable<ReturnType<typeof validateConfig>['config']>,
): Promise<{ cycle: FollowUpCycle; summaryText: string }> {
  const repliesByIndex = new Map<number, { text: string; userId: string; ts: string }[]>();

  if (opts.fixture && existsSync('fixtures/followups/engineer-replies.json')) {
    const fixture = JSON.parse(readFileSync('fixtures/followups/engineer-replies.json', 'utf-8')) as {
      replies: { proposalIndex: number; text: string; userId: string; ts: string }[];
    };
    for (const r of fixture.replies) {
      const list = repliesByIndex.get(r.proposalIndex) ?? [];
      list.push(r);
      repliesByIndex.set(r.proposalIndex, list);
    }
  } else if (!opts.dryRun && secrets.slackBotToken) {
    const client = createSlackClient(secrets);
    for (const delivery of cycle.deliveries ?? []) {
      if (delivery.deliveryStatus !== 'sent' || !delivery.dmChannelId || !delivery.sentMessageTs) continue;
      const proposal = cycle.proposals.find((p) => p.index === delivery.proposalIndex);
      if (!proposal?.slackUserId) continue;
      const replies = await readDmReplies(
        client,
        delivery.dmChannelId,
        delivery.sentMessageTs,
        proposal.slackUserId,
      );
      repliesByIndex.set(delivery.proposalIndex, replies);
    }
  }

  const classified = summarizeReplies(cycle.proposals, cycle.deliveries ?? [], repliesByIndex);
  let updated = cycle;
  for (const item of classified) {
    if (item.readStatus === 'read') {
      updated = recordCapturedReply(updated, item.engineerDisplayName, item.issueKey, item.extraction);
    }
  }

  const summary = buildCycleReplySummary(classified);
  return { cycle: updated, summaryText: renderReplySummary(summary) };
}

async function main() {
  const opts = parseArgs();
  const raw = loadConfigRaw(opts.configPath);
  const validation = validateConfig(raw);

  if (!validation.valid || !validation.config) {
    emitFollowUpResult({
      status: 'error',
      workflow: 'followups',
      slackDelivered: false,
      failureReason: 'CONFIG_INVALID',
    });
  }

  const config = validation.config;
  const ca = resolveCommunicationAssistant(config);
  const secrets = resolveSecrets(config);

  if (!opts.text) {
    emitFollowUpResult({
      status: 'error',
      workflow: 'followups',
      slackDelivered: false,
      failureReason: 'MISSING_TEXT',
    });
  }

  const parsed = parseFollowUpRequest(opts.text, config);
  if (parsed.kind !== 'startCycle') {
    const message = parsed.kind === 'unknownSquad' || parsed.kind === 'unknownCommand' ? parsed.message : 'Invalid start command';
    try {
      await postManagerMessage(message, opts, secrets);
    } catch (err) {
      // Still emit the parse failure code when Slack is down.
      if (!(err instanceof SlackPostError || (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'SLACK_POST_FAILED'))) {
        throw err;
      }
    }
    emitFollowUpResult({
      status: 'error',
      workflow: 'followups',
      slackDelivered: false,
      failureReason: parsed.kind === 'unknownSquad' ? 'UNKNOWN_SQUAD' : 'UNKNOWN_COMMAND',
    });
  }

  const squadConfig = config.squads.find((s) => s.id === parsed.squadId)!;
  if (!squadConfig.teamMemberSlackMap || Object.keys(squadConfig.teamMemberSlackMap).length === 0) {
    emitFollowUpResult({
      status: 'error',
      workflow: 'followups',
      slackDelivered: false,
      failureReason: 'MISSING_TEAM_MEMBER_SLACK_MAP',
      squadId: parsed.squadId,
    });
  }

  const fixturePath = opts.fixture
    ? opts.artifactFixture ?? `fixtures/analysis/orion-mixed-findings.json`
    : undefined;

  const loaded = loadSquadAnalysisArtifact(config, parsed.squadId, {
    fixturePath: fixturePath && existsSync(fixturePath) ? fixturePath : undefined,
  });

  if (!loaded) {
    const msg = `No analysis artifact found for ${parsed.squadDisplayName}. Run \`analyze ${parsed.squadDisplayName} squad\` first.`;
    try {
      await postManagerMessage(msg, opts, secrets);
    } catch (err) {
      if (!(err instanceof SlackPostError || (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'SLACK_POST_FAILED'))) {
        throw err;
      }
    }
    emitFollowUpResult({
      status: 'error',
      workflow: 'followups',
      slackDelivered: false,
      failureReason: 'MISSING_ARTIFACT',
      squadId: parsed.squadId,
    });
  }

  const mapped = mapFindingsToProposals(loaded.artifact, config);
  let proposals = composeProposalDrafts(mapped.proposals, undefined, { fixtureMode: opts.fixture });

  let cycle = createFollowUpCycle({
    squadId: parsed.squadId,
    managerThreadTs: opts.threadTs,
    artifactPath: loaded.artifactPath,
    analyzedAt: loaded.artifact.analyzedAt,
    possiblyStale: loaded.possiblyStale,
    proposals,
    overflowCount: mapped.overflowCount,
    dataLimitations: mapped.dataLimitations,
  });

  const preview =
    proposals.length === 0
      ? renderZeroProposalsMessage(parsed.squadDisplayName)
      : renderCyclePreview(cycle);

  let previewPost: { slackDelivered: boolean; messageTs?: string };
  try {
    previewPost = await postManagerMessage(preview, opts, secrets);
  } catch (err) {
    const isSlackFail =
      err instanceof SlackPostError ||
      (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'SLACK_POST_FAILED');
    if (isSlackFail) {
      emitFollowUpResult({
        status: 'error',
        workflow: 'followups',
        slackDelivered: false,
        failureReason: 'SLACK_POST_FAILED',
        cycleId: cycle.cycleId,
        squadId: parsed.squadId,
        proposalsGenerated: proposals.length,
        messagesSent: 0,
        messagesSkipped: 0,
        messagesFailed: 0,
        previewSnippet: preview.slice(0, 500),
      });
    }
    throw err;
  }
  const slackDelivered = previewPost.slackDelivered;
  let lastTs = previewPost.messageTs ?? opts.threadTs;

  if (opts.dryRun && !opts.poll && !opts.commandTranscript) {
    emitFollowUpResult({
      status: 'success',
      workflow: 'followups',
      slackDelivered,
      cycleId: cycle.cycleId,
      squadId: parsed.squadId,
      proposalsGenerated: proposals.length,
      messagesSent: 0,
      messagesSkipped: 0,
      messagesFailed: 0,
      previewSnippet: preview.slice(0, 500),
    });
  }

  if (!opts.poll && !opts.commandTranscript) {
    emitFollowUpResult({
      status: 'success',
      workflow: 'followups',
      slackDelivered,
      cycleId: cycle.cycleId,
      squadId: parsed.squadId,
      proposalsGenerated: proposals.length,
      messagesSent: 0,
      messagesSkipped: 0,
      messagesFailed: 0,
      previewSnippet: preview.slice(0, 500),
    });
  }

  const client = secrets.slackBotToken && !opts.dryRun ? createSlackClient(secrets) : null;
  const deadline = pollDeadline(ca.cycleMaxMinutes);

  const transcriptCommands: string[] = opts.commandTranscript && existsSync(opts.commandTranscript)
    ? (JSON.parse(readFileSync(opts.commandTranscript, 'utf-8')) as { commands: string[] }).commands
    : [];

  let transcriptIdx = 0;

  while (!isPastDeadline(deadline)) {
    let messages: { text: string; ts: string }[] = [];

    if (transcriptCommands.length && transcriptIdx < transcriptCommands.length) {
      const cmd = transcriptCommands[transcriptIdx]!;
      transcriptIdx++;
      messages = [{ text: cmd, ts: `${Date.now()}.${transcriptIdx}` }];
    } else {
      messages = await pollThreadOnce(client, {
        channel: opts.slackChannel ?? '',
        threadTs: opts.threadTs,
        sinceTs: lastTs,
        pollIntervalSeconds: ca.pollIntervalSeconds,
        cycleMaxMinutes: ca.cycleMaxMinutes,
        dryRun: opts.dryRun,
      });
    }

    if (messages.length === 0) {
      if (transcriptIdx >= transcriptCommands.length && transcriptCommands.length > 0) break;
      await sleepMs(ca.pollIntervalSeconds * 1000);
      continue;
    }

    for (const msg of messages) {
      lastTs = msg.ts;
      if (!isFollowUpManagerCommand(msg.text)) {
        continue;
      }

      const cmd = parseFollowUpRequest(msg.text, config);
      const result = processManagerCommand(cycle, cmd);
      cycle = result.cycle;

      if (!result.ok) {
        const post = await postManagerMessage(result.message, opts, secrets);
        if (post.messageTs) lastTs = post.messageTs;
        continue;
      }

      if (result.draftAnotherIndex !== undefined) {
        const base = cycle.proposals.find((p) => p.index === result.draftAnotherIndex)!;
        const continuation = buildContinuationDraft(base, cycle.inCycleContext);
        cycle = addContinuationProposal(cycle, continuation);
        const post = await postManagerMessage(renderCyclePreview(cycle), opts, secrets);
        if (post.messageTs) lastTs = post.messageTs;
        continue;
      }

      if (result.shouldSendApproved) {
        const toSend = getApprovedPendingSend(cycle).filter((p) => !cycle.deliveries?.some((d) => d.proposalIndex === p.index && d.deliveryStatus === 'sent'));
        cycle = await sendApprovedProposals(cycle, toSend, opts, secrets, config);
        const post = await postManagerMessage(renderDeliverySummary(cycle), opts, secrets);
        if (post.messageTs) lastTs = post.messageTs;
      }

      if (result.shouldStatus) {
        const { cycle: updated, summaryText } = await handleStatus(cycle, opts, secrets, config);
        cycle = updated;
        const post = await postManagerMessage(summaryText, opts, secrets);
        if (post.messageTs) lastTs = post.messageTs;
      }

      if (result.shouldClose) {
        cycle = { ...cycle, status: 'closed' };
        break;
      }

      if (result.message && !result.shouldSendApproved && !result.shouldStatus) {
        const post = await postManagerMessage(result.message, opts, secrets);
        if (post.messageTs) lastTs = post.messageTs;
      }
    }

    if (cycle.status === 'closed' || cycle.status === 'closing') break;
    if (transcriptIdx >= transcriptCommands.length && transcriptCommands.length > 0) break;
    await sleepMs(ca.pollIntervalSeconds * 1000);
  }

  cycle = { ...cycle, status: 'closed' };
  const stats = countDeliveryStats(cycle);

  emitFollowUpResult({
    status: 'success',
    workflow: 'followups',
    slackDelivered,
    cycleId: cycle.cycleId,
    squadId: parsed.squadId,
    proposalsGenerated: cycle.proposals.length,
    ...stats,
    previewSnippet: preview.slice(0, 500),
  });
}

main().catch((err) => {
  if (err instanceof SlackPostError) {
    const validated = followUpRunResultSchema.parse({
      status: 'error',
      workflow: 'followups',
      slackDelivered: false,
      failureReason: 'SLACK_POST_FAILED',
    });
    console.log(JSON.stringify(validated, null, 2));
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
