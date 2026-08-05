# Spec Kit Autopilot Extension

Chains the core Spec Kit pipeline end-to-end inside Cursor with two modes
**and per-phase model routing**.

| Cursor skill | Mode | When to use |
|---|---|---|
| `/speckit-autopilot-run` | Full auto | Trust defaults; review PR + `autopilot-assumptions.md` |
| `/speckit-autopilot-review` | Review gates | Pause on clarify / Critical analysis / before implement |
| `/speckit-autopilot-sync-models` | Setup | Apply `models.yml` → `.cursor/agents/*` |

## Install (dev)

```powershell
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"
cd C:\MTN\Tools\spec-kit-sandbox
specify extension add --dev .\extensions\speckit-autopilot --force
specify extension list
powershell -NoProfile -File .\extensions\speckit-autopilot\scripts\Sync-ModelRouting.ps1
```

## Phase → model routing

Edit **either**:

- Project: `.specify/extensions/autopilot/models.yml` (preferred after install)
- Source: `extensions/speckit-autopilot/models.yml`

Then sync:

```powershell
/speckit-autopilot-sync-models
# or
powershell -NoProfile -File .\.specify\extensions\autopilot\scripts\Sync-ModelRouting.ps1
```

### Example config

```yaml
phases:
  constitution: opus-4.7   # or opus-5
  specify: opus-4.7
  clarify: opus-4.7
  plan: composer
  analyze: composer
  tasks: composer
  implement: composer
```

Aliases expand to Cursor model IDs (e.g. `opus-4.7` → `claude-opus-4-7-thinking-xhigh`,
`composer` → `composer-2.5-fast`). You may also put a raw ID.

### How it actually switches models

Cursor skills cannot pin a model by themselves. Routing works by:

1. Sync script writing **subagents** under `.cursor/agents/speckit-<phase>.md` with `model:` frontmatter
2. Autopilot **delegating each phase** as a Task/subagent with that model (or the agent name)

Status lines include the model:

```text
[autopilot] specify started model=claude-opus-4-7-thinking-xhigh
[autopilot] plan started model=composer-2.5-fast
```

Resolved map (machine-readable): `.specify/extensions/autopilot/models.resolved.json`

### Switching to Opus 5 for constitution/specify

```yaml
phases:
  constitution: opus-5
  specify: opus-5
  clarify: opus-5
  plan: composer
  analyze: composer
  tasks: composer
  implement: composer
```

Then re-run sync.

## Commands

### Full auto — `speckit.autopilot.run`

Runs specify → clarify → plan → analyze → tasks → implement without pausing.
Auto-answers clarifications into `autopilot-assumptions.md`.
Each phase uses its mapped model.

### Review — `speckit.autopilot.review`

Same chain; pauses when:

- Clarify is not high-confidence
- Analyze finds Critical/High issues
- Just before implement writes application code

## Uninstall

```powershell
specify extension remove autopilot
```
