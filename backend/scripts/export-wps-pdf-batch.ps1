[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$SourceRoot = '',

  [Parameter(Mandatory = $false)]
  [string]$ManifestPath = '',

  [Parameter(Mandatory = $false)]
  [string]$OutputRoot = '',

  [ValidateSet('original', 'answer', 'both')]
  [string]$Mode = 'both',

  [int]$Limit = 0,
  [string]$StartAt = '',
  [switch]$Force,
  [switch]$Strict,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
  $ManifestPath = Join-Path $scriptRoot '..\resources\exam-library-manifest.json'
}
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path $scriptRoot '..\..\..\..\z-rubbish\panpan-question-bank\pdfs'
}

function Write-Event {
  param([hashtable]$Data)
  $Data.timestamp = (Get-Date).ToUniversalTime().ToString('o')
  [Console]::Out.WriteLine(($Data | ConvertTo-Json -Compress -Depth 8))
}

function Convert-SourceRoot {
  param([string]$Value)
  if ($Value -match '^/mnt/([a-zA-Z])/(.*)$') {
    $drive = $Matches[1].ToUpperInvariant()
    $tail = $Matches[2] -replace '/', '\'
    return "${drive}:\$tail"
  }
  return $Value
}

function Test-Pdf {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
  $item = Get-Item -LiteralPath $Path
  if ($item.Length -lt 1024) { return $false }
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $header = New-Object byte[] 5
    if ($stream.Read($header, 0, 5) -ne 5) { return $false }
    return ([System.Text.Encoding]::ASCII.GetString($header) -eq '%PDF-')
  } finally {
    $stream.Dispose()
  }
}

function New-WpsApplication {
  $instance = New-Object -ComObject KWPS.Application
  $instance.Visible = $false
  try { $instance.DisplayAlerts = 0 } catch { }
  return $instance
}

function Close-WpsApplication {
  param($Application)
  if ($null -eq $Application) { return }
  try { $Application.Quit() } catch { }
  try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($Application) } catch { }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

function Export-DocxPdf {
  param(
    $Application,
    [string]$InputPath,
    [string]$OutputPath
  )
  $document = $null
  $partPath = "$OutputPath.part.pdf"
  if (Test-Path -LiteralPath $partPath) { Remove-Item -LiteralPath $partPath -Force }
  try {
    # ConfirmConversions=false, ReadOnly=true. PDF enum is wdExportFormatPDF=17.
    $document = $Application.Documents.Open($InputPath, $false, $true)
    $document.ExportAsFixedFormat($partPath, 17)
    if (-not (Test-Pdf -Path $partPath)) {
      throw "WPS produced an invalid PDF: $partPath"
    }
    Move-Item -LiteralPath $partPath -Destination $OutputPath -Force
  } finally {
    if ($null -ne $document) {
      try { $document.Close(0) } catch { }
      try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document) } catch { }
    }
    if (Test-Path -LiteralPath $partPath) { Remove-Item -LiteralPath $partPath -Force }
  }
}

$resolvedManifest = [IO.Path]::GetFullPath($ManifestPath)
if (-not (Test-Path -LiteralPath $resolvedManifest -PathType Leaf)) {
  throw "Manifest not found: $resolvedManifest"
}
$manifest = Get-Content -LiteralPath $resolvedManifest -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($SourceRoot)) { $SourceRoot = Convert-SourceRoot $manifest.source_root }
$SourceRoot = [IO.Path]::GetFullPath((Convert-SourceRoot $SourceRoot))
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
if (-not (Test-Path -LiteralPath $SourceRoot -PathType Container)) { throw "Source root not found: $SourceRoot" }

$jobs = New-Object System.Collections.Generic.List[object]
$roles = if ($Mode -eq 'both') { @('original', 'answer') } else { @($Mode) }
$started = [string]::IsNullOrWhiteSpace($StartAt)
foreach ($paper in $manifest.papers) {
  if (-not $started) {
    if ($paper.stable_code -eq $StartAt) { $started = $true } else { continue }
  }
  $paperRelative = [string]$paper.source_relative_path
  $paperPath = Join-Path $SourceRoot ($paperRelative -replace '/', '\')
  $paperDirectory = Split-Path -Parent $paperPath
  foreach ($role in $roles) {
    if ($role -eq 'original') {
      $inputPath = $paperPath
    } else {
      if ($null -eq $paper.answer -or [string]::IsNullOrWhiteSpace([string]$paper.answer.name)) { continue }
      $inputPath = Join-Path $paperDirectory ([string]$paper.answer.name)
    }
    if (-not (Test-Path -LiteralPath $inputPath -PathType Leaf)) {
      $jobs.Add([pscustomobject]@{ stable_code=$paper.stable_code; role=$role; input=$inputPath; missing=$true })
      continue
    }
    $targetDirectory = Join-Path $OutputRoot $role
    $targetPath = Join-Path $targetDirectory ("{0}.pdf" -f $paper.stable_code)
    $jobs.Add([pscustomobject]@{ stable_code=$paper.stable_code; role=$role; input=$inputPath; output=$targetPath; missing=$false })
  }
}
if ($Limit -gt 0) { $jobs = @($jobs | Select-Object -First $Limit) }

New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
$statePath = Join-Path $OutputRoot 'export-state.jsonl'
$summaryPath = Join-Path $OutputRoot 'export-summary.json'
$wps = $null
$success = 0
$skipped = 0
$failed = 0
$missing = 0
$startedAt = Get-Date

Write-Event @{ phase='start'; source_root=$SourceRoot; output_root=$OutputRoot; mode=$Mode; jobs=$jobs.Count; dry_run=[bool]$DryRun }
try {
  foreach ($job in $jobs) {
    $timer = [Diagnostics.Stopwatch]::StartNew()
    $event = @{ phase='item'; stable_code=$job.stable_code; role=$job.role; input=$job.input; output=$job.output }
    try {
      if ($job.missing) {
        $missing += 1
        $event.status = 'missing'
      } elseif ((-not $Force) -and (Test-Pdf -Path $job.output)) {
        $skipped += 1
        $event.status = 'skipped'
      } elseif ($DryRun) {
        $skipped += 1
        $event.status = 'dry_run'
      } else {
        New-Item -ItemType Directory -Path (Split-Path -Parent $job.output) -Force | Out-Null
        $extension = [IO.Path]::GetExtension($job.input).ToLowerInvariant()
        if ($extension -eq '.pdf') {
          Copy-Item -LiteralPath $job.input -Destination $job.output -Force
          if (-not (Test-Pdf -Path $job.output)) { throw "Source PDF is invalid: $($job.input)" }
        } else {
          if ($null -eq $wps) { $wps = New-WpsApplication }
          try {
            Export-DocxPdf -Application $wps -InputPath $job.input -OutputPath $job.output
          } catch {
            # A broken document can poison the COM session. Restart once and retry.
            Close-WpsApplication -Application $wps
            $wps = New-WpsApplication
            Export-DocxPdf -Application $wps -InputPath $job.input -OutputPath $job.output
          }
        }
        $success += 1
        $event.status = 'exported'
        $event.bytes = (Get-Item -LiteralPath $job.output).Length
      }
    } catch {
      $failed += 1
      $event.status = 'error'
      $event.error = $_.Exception.Message
    } finally {
      $timer.Stop()
      $event.duration_ms = $timer.ElapsedMilliseconds
      $event.timestamp = (Get-Date).ToUniversalTime().ToString('o')
      $json = $event | ConvertTo-Json -Compress -Depth 8
      Add-Content -LiteralPath $statePath -Value $json -Encoding UTF8
      [Console]::Out.WriteLine($json)
    }
  }
} finally {
  Close-WpsApplication -Application $wps
}

$summary = [ordered]@{
  generated_at = (Get-Date).ToUniversalTime().ToString('o')
  source_root = $SourceRoot
  output_root = $OutputRoot
  mode = $Mode
  total = $jobs.Count
  exported = $success
  skipped = $skipped
  missing = $missing
  failed = $failed
  partial = [bool]($failed -gt 0 -or $missing -gt 0)
  duration_seconds = [Math]::Round(((Get-Date) - $startedAt).TotalSeconds, 2)
  state_file = $statePath
}
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
Write-Event (@{ phase='complete' } + $summary)
if ($Strict -and ($failed -gt 0 -or $missing -gt 0)) { exit 2 }
