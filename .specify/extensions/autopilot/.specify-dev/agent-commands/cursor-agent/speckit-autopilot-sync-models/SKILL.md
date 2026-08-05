---
name: speckit-autopilot-sync-models
description: Sync Spec Kit phase→model routing from models.yml into Cursor subagents
  (.cursor/agents).
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: github-spec-kit
  source: autopilot:commands/sync-models.md
---

# Autopilot model routing sync

## User Input

```text
$ARGUMENTS
```

Optional: free-form notes about desired mapping changes (e.g. "put implement on sonnet"). Prefer editing the config file first.

## Goal

Materialize Cursor **subagents with per-phase models** from the project model map so autopilot and `/speckit-*` phase work can dispatch with the right model.

## Steps

1. Ensure a config exists (first match wins):
   - `.specify/extensions/autopilot/models.yml`  (preferred, project local)
   - `extensions/speckit-autopilot/models.yml`  (extension source)
   - templates: `models.template.yml` in either location

2. If the user asked to change mappings in `$ARGUMENTS` and the change is unambiguous, update `models.yml` first:
   - Only edit keys under `phases:` and `aliases:`
   - Keep YAML simple (no multiline values)
   - Aliases available: `opus-4.7`, `opus-5`, `composer`, `sonnet`, `inherit`, and any exact Cursor model id

3. Run the sync script from the Spec Kit project root:

```powershell
$env:PYTHONIOENCODING = "utf-8"
powershell -NoProfile -File ".specify\extensions\autopilot\scripts\Sync-ModelRouting.ps1"
```

If the installed extension copy lacks the script, run:

```powershell
powershell -NoProfile -File "extensions\speckit-autopilot\scripts\Sync-ModelRouting.ps1"
```

4. Verify:
   - `.specify/extensions/autopilot/models.resolved.json` lists each phase model
   - `.cursor/agents/speckit-<phase>.md` files exist with `model: <id>` frontmatter

5. Report the resolved table to the user and remind them:

| How to use | Effect |
|---|---|
| `/speckit-autopilot-run` | Parent **must** Task-delegate each phase to agent `speckit-<phase>` (or Task with that model) |
| Explicit subagent | e.g. invoke `speckit-specify` agent from the Task picker / `@` agents |
| Parent-only chat model | Does **not** override phase subagent models once agents are synced |

Do not modify core `speckit-specify` skill files. Routing lives in models.yml + generated agents only.