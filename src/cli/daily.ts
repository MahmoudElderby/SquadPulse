#!/usr/bin/env node
import { loadConfigRaw } from '../config/load.js';
import { validateConfig } from '../config/validate.js';
import { resolveSecrets } from '../config/secrets.js';
import { resolveConfigPath } from '../config/resolve-path.js';
import { analyzeSnapshot } from '../analysis/engine.js';
import { detectCrossSquadPriorities } from '../analysis/cross-squad.js';
import { renderDailyBriefing, buildDailyBriefingAggregate } from '../report/render-daily-briefing.js';
import { postSlackMessage, dryRunPost } from '../slack/post-message.js';
import { fetchSquadSnapshot } from '../jira/fetch-squad.js';
import { JiraClient, JiraAuthError } from '../jira/client.js';
import { loadFixtureSnapshot, isFixtureMode } from '../lib/fixture-mode.js';
import { checkScheduleGuard } from '../lib/schedule-guard.js';
import { exitWithRunResult, emitRunResult } from '../lib/run-result.js';
import { formatReportDate, nowInTimezone } from '../lib/datetime.js';
import { readFileSync, existsSync } from 'node:fs';
import { validateContextualAnalysis } from '../ai/validate-contextual.js';
import type { NormalizedSquadSnapshot } from '../contracts/normalized-squad-snapshot.js';
import type { DeterministicFindings } from '../contracts/deterministic-findings.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  return {
    fixture: isFixtureMode(args),
    force: args.includes('--force'),
    refresh: args.includes('--refresh'),
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
      workflow: 'daily',
      slackDelivered: false,
      failureReason: 'CONFIG_INVALID',
    });
  }

  const config = validation.config;
  const schedule = checkScheduleGuard(config, { force: opts.force, refresh: opts.refresh });

  if (!schedule.shouldRun) {
    console.log(`Skipping: ${schedule.reason}`);
    process.exit(0);
  }

  const tz = schedule.timezone;
  const secrets = resolveSecrets(config);
  const squadsAnalyzed: string[] = [];
  const squadsFailed: { squadId: string; reason: string }[] = [];
  const snapshots: NormalizedSquadSnapshot[] = [];
  const findingsList: { squadId: string; findings: DeterministicFindings; unavailable?: boolean; unavailableReason?: string }[] = [];
  const limitations: { scope: string; reason: string }[] = [];

  let client: JiraClient | null = null;
  if (!opts.fixture) {
    client = new JiraClient(secrets);
  }

  for (const squad of config.squads) {
    try {
      let snapshot: NormalizedSquadSnapshot;
      if (opts.fixture) {
        snapshot = loadFixtureSnapshot(squad.id);
      } else {
        const result = await fetchSquadSnapshot(client!, squad, tz, config.squads.map((s) => s.id));
        if (client!.isAuthFailed) {
          exitWithRunResult({
            status: 'error',
            workflow: 'daily',
            slackDelivered: false,
            failureReason: 'JIRA_AUTH_FAILED',
          });
        }
        if (result.error) {
          squadsFailed.push({ squadId: squad.id, reason: result.error });
          findingsList.push({
            squadId: squad.id,
            findings: emptyFindings(squad.id),
            unavailable: true,
            unavailableReason: result.error,
          });
          continue;
        }
        snapshot = result.snapshot;
      }

      snapshots.push(snapshot);
      const findings = analyzeSnapshot(snapshot, squad);
      findingsList.push({ squadId: squad.id, findings });
      squadsAnalyzed.push(squad.id);
      if (snapshot.limitations) limitations.push(...snapshot.limitations);
    } catch (err) {
      if (err instanceof JiraAuthError) {
        exitWithRunResult({
          status: 'error',
          workflow: 'daily',
          slackDelivered: false,
          failureReason: 'JIRA_AUTH_FAILED',
        });
      }
      const reason = err instanceof Error ? err.message : String(err);
      squadsFailed.push({ squadId: squad.id, reason });
      findingsList.push({
        squadId: squad.id,
        findings: emptyFindings(squad.id),
        unavailable: true,
        unavailableReason: reason,
      });
    }
  }

  const crossSquadPriorities = detectCrossSquadPriorities(snapshots);
  const squadSummaries = config.squads.map((squad) => {
    const entry = findingsList.find((f) => f.squadId === squad.id)!;
    const health = entry.unavailable ? 'Unavailable' as const : entry.findings.health.status;
    const riskCount = entry.findings.deliveryRisks.length;
    const oneLine = entry.unavailable
      ? 'Data unavailable'
      : `${riskCount} delivery risk(s); ${entry.findings.blockers.length} blocker(s)`;
    return {
      squadId: squad.id,
      displayName: squad.displayName,
      oneLineStatus: oneLine,
      healthStatus: health,
    };
  });

  let contextual;
  if (opts.includeDrafts && existsSync('fixtures/ai/sample-contextual-analysis.json')) {
    contextual = validateContextualAnalysis(
      JSON.parse(readFileSync('fixtures/ai/sample-contextual-analysis.json', 'utf-8')),
    );
  }

  const briefing = buildDailyBriefingAggregate({
    generatedAt: nowInTimezone(tz).toISO()!,
    timezone: tz,
    reportDate: formatReportDate(tz),
    isRefresh: schedule.isRefresh ?? false,
    squadSummaries,
    crossSquadPriorities,
    perSquadFindings: findingsList,
    limitations,
    standUpFocusItems: contextual?.standUpFocusItems,
    followUpDrafts: contextual?.followUpDrafts,
  });

  const report = renderDailyBriefing(briefing, contextual);

  let slackDelivered = false;
  if (secrets.slackBotToken) {
    try {
      await postSlackMessage({
        secrets,
        channel: config.slack.managerDestination,
        text: report,
      });
      slackDelivered = true;
    } catch {
      emitRunResult({
        status: squadsFailed.length ? 'partial' : 'partial',
        workflow: 'daily',
        slackDelivered: false,
        failureReason: 'SLACK_POST_FAILED',
        squadsAnalyzed,
        squadsFailed: squadsFailed.length ? squadsFailed : undefined,
        isRefresh: briefing.isRefresh,
        reportPreview: report.slice(0, 500),
      });
      process.exit(1);
    }
  } else {
    dryRunPost(report);
    console.log(report);
  }

  exitWithRunResult({
    status: squadsFailed.length ? 'partial' : 'success',
    workflow: 'daily',
    slackDelivered,
    squadsAnalyzed,
    squadsFailed: squadsFailed.length ? squadsFailed : undefined,
    isRefresh: briefing.isRefresh,
  });
}

function emptyFindings(squadId: string): DeterministicFindings {
  return {
    squadId,
    health: { status: 'On Track', reasons: [], deliveryRiskCount: 0 },
    deliveryRisks: [],
    blockers: [],
    hygieneFindings: [],
    flowSignals: [],
    managerActions: [],
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
