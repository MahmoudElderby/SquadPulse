#!/usr/bin/env node
import { loadConfigRaw } from '../config/load.js';
import { validateConfig } from '../config/validate.js';
import { resolveSecrets } from '../config/secrets.js';
import { resolveConfigPath } from '../config/resolve-path.js';
import { parseSlackRequest } from '../slack/parse-request.js';
import { analyzeSnapshot } from '../analysis/engine.js';
import { renderSquadReport } from '../report/render-squad-report.js';
import { postSlackMessage, dryRunPost } from '../slack/post-message.js';
import { fetchSquadSnapshot } from '../jira/fetch-squad.js';
import { JiraClient, JiraAuthError } from '../jira/client.js';
import { loadFixtureSnapshot, isFixtureMode } from '../lib/fixture-mode.js';
import { exitWithRunResult, emitRunResult } from '../lib/run-result.js';
import { readFileSync, existsSync } from 'node:fs';
import { validateContextualAnalysis } from '../ai/validate-contextual.js';
import { mergeContextualAnalysis } from '../ai/merge-contextual.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  return {
    text: get('--text') ?? '',
    slackChannel: get('--slack-channel'),
    threadTs: get('--thread-ts'),
    fixture: isFixtureMode(args),
    configPath: resolveConfigPath(get('--config')),
    includeDrafts: args.includes('--include-drafts'),
  };
}

async function main() {
  const opts = parseArgs();
  const raw = loadConfigRaw(opts.configPath);
  const validation = validateConfig(raw);

  if (!validation.valid || !validation.config) {
    exitWithRunResult({
      status: 'error',
      workflow: 'on-demand',
      slackDelivered: false,
      failureReason: 'CONFIG_INVALID',
    });
  }

  const config = validation.config;
  const secrets = resolveSecrets(config);

  if (!opts.text) {
    exitWithRunResult({
      status: 'error',
      workflow: 'on-demand',
      slackDelivered: false,
      failureReason: 'MISSING_TEXT',
    });
  }

  const parsed = parseSlackRequest(opts.text, config);
  if (parsed.kind !== 'analysis') {
    const message = parsed.message;
    if (opts.slackChannel && secrets.slackBotToken) {
      try {
        await postSlackMessage({
          secrets,
          channel: opts.slackChannel,
          text: message,
          threadTs: opts.threadTs,
        });
      } catch {
        // validation message best-effort
      }
    }
    console.log(message);
    exitWithRunResult({
      status: 'error',
      workflow: 'on-demand',
      slackDelivered: false,
      failureReason: parsed.kind === 'unknownSquad' ? 'UNKNOWN_SQUAD' : 'UNKNOWN_INTENT',
    });
  }

  const squadConfig = config.squads.find((s) => s.id === parsed.squadId)!;
  const tz = config.schedule?.timezone ?? 'UTC';

  let snapshot;
  try {
    if (opts.fixture) {
      snapshot = loadFixtureSnapshot(parsed.squadId);
    } else {
      const client = new JiraClient(secrets);
      const result = await fetchSquadSnapshot(
        client,
        squadConfig,
        tz,
        config.squads.map((s) => s.id),
      );
      if (client.isAuthFailed) {
        exitWithRunResult({
          status: 'error',
          workflow: 'on-demand',
          slackDelivered: false,
          failureReason: 'JIRA_AUTH_FAILED',
        });
      }
      snapshot = result.snapshot;
    }
  } catch (err) {
    if (err instanceof JiraAuthError) {
      exitWithRunResult({
        status: 'error',
        workflow: 'on-demand',
        slackDelivered: false,
        failureReason: 'JIRA_AUTH_FAILED',
      });
    }
    throw err;
  }

  let findings = analyzeSnapshot(snapshot, squadConfig);
  let contextual;

  if (opts.includeDrafts) {
    const path = 'fixtures/ai/sample-contextual-analysis.json';
    if (existsSync(path)) {
      contextual = validateContextualAnalysis(JSON.parse(readFileSync(path, 'utf-8')));
      ({ findings, contextual } = mergeContextualAnalysis(findings, contextual));
    }
  }

  const report = renderSquadReport({
    snapshot,
    findings,
    contextual,
    intent: parsed.intent,
    includeDrafts: opts.includeDrafts,
  });

  let slackDelivered = false;
  if (opts.slackChannel && secrets.slackBotToken) {
    try {
      await postSlackMessage({
        secrets,
        channel: opts.slackChannel,
        text: report,
        threadTs: opts.threadTs,
      });
      slackDelivered = true;
    } catch {
      emitRunResult({
        status: 'partial',
        workflow: 'on-demand',
        slackDelivered: false,
        failureReason: 'SLACK_POST_FAILED',
        squadsAnalyzed: [parsed.squadId],
        reportPreview: report.slice(0, 500),
      });
      process.exit(1);
    }
  } else {
    dryRunPost(report);
    console.log(report);
  }

  exitWithRunResult({
    status: 'success',
    workflow: 'on-demand',
    slackDelivered,
    squadsAnalyzed: [parsed.squadId],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
