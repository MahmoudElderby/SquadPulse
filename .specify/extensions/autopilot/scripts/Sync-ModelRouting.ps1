#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Resolve phase→model map and materialize Cursor subagent binders for Spec Kit phases.
#>
[CmdletBinding()]
param(
    [string]$ProjectRoot = "",
    [string]$ConfigPath = "",
    [switch]$DryRun,
    [switch]$Json
)

$ErrorActionPreference = "Stop"

function Find-ProjectRoot {
    param([string]$Start)
    $dir = (Resolve-Path $Start).Path
    while ($true) {
        if (Test-Path (Join-Path $dir ".specify")) { return $dir }
        $parent = Split-Path $dir -Parent
        if (-not $parent -or $parent -eq $dir) { break }
        $dir = $parent
    }
    return $null
}

function Get-YamlScalarMap {
    param([string]$Text)
    $result = @{
        schema_version = $null
        execution      = "task"
        phases         = [ordered]@{}
        aliases        = [ordered]@{}
    }
    $section = $null
    foreach ($raw in ($Text -split "`n")) {
        $line = $raw.TrimEnd("`r")
        if ($line -match '^\s*#' -or $line.Trim() -eq "") { continue }
        if ($line -match '^(schema_version)\s*:\s*(.+)\s*$') {
            $result.schema_version = $matches[2].Trim().Trim('"').Trim("'")
            $section = $null
            continue
        }
        if ($line -match '^(execution)\s*:\s*(.+)\s*$') {
            $result.execution = $matches[2].Trim().Trim('"').Trim("'")
            $section = $null
            continue
        }
        if ($line -match '^(phases)\s*:\s*$') { $section = "phases"; continue }
        if ($line -match '^(aliases)\s*:\s*$') { $section = "aliases"; continue }
        if ($line -match '^(labels)\s*:\s*$') { $section = "labels"; continue }
        if ($section -and $line -match '^\s+("?)([^":]+)\1\s*:\s*(.+)\s*$') {
            $key = $matches[2].Trim()
            $val = $matches[3].Trim().Trim('"').Trim("'")
            if ($section -eq "phases") { $result.phases[$key] = $val }
            elseif ($section -eq "aliases") { $result.aliases[$key] = $val }
        }
    }
    return $result
}

function Resolve-Model {
    param(
        [string]$Raw,
        $Aliases,
        [int]$Depth = 0
    )
    if ([string]::IsNullOrWhiteSpace($Raw)) { return "inherit" }
    $value = $Raw.Trim()
    if ($Depth -gt 8) { return $value }
    $key = $value.ToLowerInvariant()
    foreach ($ak in @($Aliases.Keys)) {
        if ($ak.ToString().ToLowerInvariant() -eq $key) {
            $next = [string]$Aliases[$ak]
            if ($next -eq $value) { return $value }
            return (Resolve-Model -Raw $next -Aliases $Aliases -Depth ($Depth + 1))
        }
    }
    return $value
}

function New-PhaseAgentMarkdown {
    param(
        [string]$Phase,
        [string]$Model,
        [string]$AgentName,
        [string]$SkillName,
        [string]$Description
    )

    $nl = "`n"
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine("---")
    [void]$sb.AppendLine("name: $AgentName")
    [void]$sb.AppendLine("description: >-")
    [void]$sb.AppendLine("  Spec Kit phase agent for /$SkillName. Use proactively when the autopilot")
    [void]$sb.AppendLine("  pipeline or user requests the $Phase phase. $Description")
    [void]$sb.AppendLine("model: $Model")
    [void]$sb.AppendLine("---")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("You are the dedicated **$Phase** phase worker for Spec-Driven Development (Spec Kit).")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("## Model")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("Configured model for this phase: ``$Model`` (from project models.yml).")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("## Instructions")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("1. Read and fully follow the skill file at:")
    [void]$sb.AppendLine("   ``.cursor/skills/$SkillName/SKILL.md``")
    [void]$sb.AppendLine("   If that path is missing, search the project for the equivalent Spec Kit skill and follow it.")
    [void]$sb.AppendLine("2. Respect ``.specify/memory/constitution.md`` and existing ``specs/`` artifacts.")
    [void]$sb.AppendLine("3. Do only this phase work. Do not run later pipeline phases.")
    [void]$sb.AppendLine("4. When finished, return a short summary:")
    [void]$sb.AppendLine("   - Phase: $Phase")
    [void]$sb.AppendLine("   - Model used: $Model")
    [void]$sb.AppendLine("   - Paths created or updated")
    [void]$sb.AppendLine("   - Any blockers or NEEDS CLARIFICATION remaining")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("## User / parent input")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("The parent agent or user will provide the feature request and paths to prior artifacts.")
    [void]$sb.AppendLine('Treat that input as your $ARGUMENTS for the skill.')
    return $sb.ToString()
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ProjectRoot) {
    $ProjectRoot = Find-ProjectRoot -Start (Get-Location).Path
    if (-not $ProjectRoot) {
        $ProjectRoot = Find-ProjectRoot -Start $scriptDir
    }
}
if (-not $ProjectRoot) {
    throw "Could not locate Spec Kit project root (no .specify/ folder)."
}

$extDir = Join-Path $ProjectRoot ".specify\extensions\autopilot"
$devExt = Join-Path $ProjectRoot "extensions\speckit-autopilot"
if (-not $ConfigPath) {
    foreach ($candidate in @(
            (Join-Path $extDir "models.yml"),
            (Join-Path $devExt "models.yml"),
            (Join-Path $extDir "models.template.yml"),
            (Join-Path $devExt "models.template.yml")
        )) {
        if (Test-Path $candidate) { $ConfigPath = $candidate; break }
    }
}
if (-not $ConfigPath -or -not (Test-Path $ConfigPath)) {
    throw "models.yml not found. Expected under .specify/extensions/autopilot/ or extensions/speckit-autopilot/."
}

$map = Get-YamlScalarMap -Text (Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8)
$aliases = @{}
foreach ($k in @($map.aliases.Keys)) { $aliases[$k] = $map.aliases[$k] }

$defaultPhases = @(
    "constitution", "specify", "clarify", "plan", "analyze",
    "tasks", "implement", "checklist", "converge", "taskstoissues"
)

$resolvedList = @()
foreach ($phase in $defaultPhases) {
    $raw = if ($map.phases.Contains($phase)) { [string]$map.phases[$phase] } else { "inherit" }
    $resolvedList += [pscustomobject]@{
        phase      = $phase
        configured = $raw
        model      = (Resolve-Model -Raw $raw -Aliases $aliases)
        skill      = "speckit-$phase"
        agent      = "speckit-$phase"
    }
}

$agentsDir = Join-Path $ProjectRoot ".cursor\agents"
$outJson = Join-Path $extDir "models.resolved.json"
if (-not (Test-Path $extDir)) {
    New-Item -ItemType Directory -Force -Path $extDir | Out-Null
}

$payload = [ordered]@{
    schema_version = $map.schema_version
    execution      = $map.execution
    config_path    = $ConfigPath
    generated_at   = (Get-Date).ToString("o")
    phases         = $resolvedList
}

if ($Json) {
    $payload | ConvertTo-Json -Depth 6
}

if ($DryRun) {
    Write-Host "Dry run - would write agents to $agentsDir"
    foreach ($row in $resolvedList) {
        Write-Host ("  {0,-14} {1,-28} -> {2}" -f $row.phase, $row.configured, $row.model)
    }
    exit 0
}

if (-not (Test-Path $agentsDir)) {
    New-Item -ItemType Directory -Force -Path $agentsDir | Out-Null
}

$skillBlurb = @{
    constitution  = "Create or update project constitution principles."
    specify       = "Write feature specification (what and why) under specs/."
    clarify       = "Resolve underspecified requirements and NEEDS CLARIFICATION markers."
    plan          = "Create technical implementation plan from the clarified spec."
    analyze       = "Cross-artifact consistency and coverage analysis."
    tasks         = "Break plan into actionable, story-scoped tasks."
    implement     = "Execute tasks and implement the feature."
    checklist     = "Generate quality checklists for requirements."
    converge      = "Assess codebase against specs and append remaining tasks."
    taskstoissues = "Convert tasks into tracker issues."
}

foreach ($entry in $resolvedList) {
    $desc = $skillBlurb[$entry.phase]
    if (-not $desc) { $desc = "Spec Kit phase: $($entry.phase)" }
    $body = New-PhaseAgentMarkdown `
        -Phase $entry.phase `
        -Model $entry.model `
        -AgentName $entry.agent `
        -SkillName $entry.skill `
        -Description $desc
    $path = Join-Path $agentsDir "$($entry.agent).md"
    [System.IO.File]::WriteAllText($path, $body, [System.Text.UTF8Encoding]::new($false))
}

($payload | ConvertTo-Json -Depth 6) | Set-Content -LiteralPath $outJson -Encoding UTF8

$installedModels = Join-Path $extDir "models.yml"
$cfgResolved = (Resolve-Path -LiteralPath $ConfigPath).Path
$destResolved = $null
if (Test-Path $installedModels) {
    $destResolved = (Resolve-Path -LiteralPath $installedModels).Path
}
if ($cfgResolved -ne $destResolved) {
    Copy-Item -LiteralPath $ConfigPath -Destination $installedModels -Force
}

# Ensure script is available under installed extension path
$installedScripts = Join-Path $extDir "scripts"
if (-not (Test-Path $installedScripts)) {
    New-Item -ItemType Directory -Force -Path $installedScripts | Out-Null
}
$scriptSrc = (Resolve-Path -LiteralPath $MyInvocation.MyCommand.Path).Path
$scriptDest = Join-Path $installedScripts "Sync-ModelRouting.ps1"
$scriptDestResolved = $null
if (Test-Path $scriptDest) {
    $scriptDestResolved = (Resolve-Path -LiteralPath $scriptDest).Path
}
if ($scriptSrc -ne $scriptDestResolved) {
    Copy-Item -LiteralPath $scriptSrc -Destination $scriptDest -Force
}

Write-Host "Model routing synced."
Write-Host "  Config : $ConfigPath"
Write-Host "  Resolved JSON : $outJson"
Write-Host "  Agents dir : $agentsDir"
foreach ($row in $resolvedList) {
    Write-Host ("  {0,-14} {1,-28} -> {2}" -f $row.phase, $row.configured, $row.model)
}
