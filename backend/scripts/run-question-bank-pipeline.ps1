[CmdletBinding()]
param(
  [string]$SourceRoot = '',
  [string]$ManifestPath = '',
  [string]$WorkingRoot = '',
  [string]$OutputRoot = '',
  [string]$TerminalOutputRoot = '',
  [string]$PythonExe = '',
  [int]$Count = 1000,
  [int]$RecentCount = 500,
  [int]$RecentFrom = 2024,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = [IO.Path]::GetFullPath((Join-Path $scriptRoot '..'))
$repoRoot = [IO.Path]::GetFullPath((Join-Path $backendRoot '..\..\..'))
if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
  $ManifestPath = Join-Path $backendRoot 'resources\exam-library-manifest.json'
}
if ([string]::IsNullOrWhiteSpace($WorkingRoot)) {
  $WorkingRoot = Join-Path $repoRoot 'z-rubbish\panpan-question-bank'
}
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path $backendRoot 'resources\choice-king'
}
if ([string]::IsNullOrWhiteSpace($TerminalOutputRoot)) {
  $TerminalOutputRoot = Join-Path $backendRoot 'resources\weekly-challenges'
}
if ([string]::IsNullOrWhiteSpace($PythonExe)) {
  $PythonExe = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
}
if (-not (Test-Path -LiteralPath $PythonExe -PathType Leaf)) {
  throw "Python runtime not found. Pass -PythonExe explicitly: $PythonExe"
}

$pdfRoot = Join-Path $WorkingRoot 'pdfs'
$exportParams = @{
  ManifestPath = $ManifestPath
  OutputRoot = $pdfRoot
  Mode = 'both'
}
if (-not [string]::IsNullOrWhiteSpace($SourceRoot)) { $exportParams.SourceRoot = $SourceRoot }
if ($Force) { $exportParams.Force = $true }

& (Join-Path $scriptRoot 'export-wps-pdf-batch.ps1') @exportParams
if (-not $?) { throw 'PDF export failed' }

$buildArgs = @(
  (Join-Path $scriptRoot 'build-choice-king-bank.py'),
  '--exam-manifest', $ManifestPath,
  '--pdf-root', $pdfRoot,
  '--output', $OutputRoot,
  '--count', [string]$Count,
  '--recent-count', [string]$RecentCount,
  '--recent-from', [string]$RecentFrom
)
if ($Force) { $buildArgs += '--force' }
& $PythonExe @buildArgs
if ($LASTEXITCODE -ne 0) { throw "Question-bank build failed with exit code $LASTEXITCODE" }

$terminalArgs = @(
  (Join-Path $scriptRoot 'build-terminal-challenges.py'),
  '--exam-manifest', $ManifestPath,
  '--pdf-root', $pdfRoot,
  '--output', $TerminalOutputRoot
)
if ($Force) { $terminalArgs += '--force' }
& $PythonExe @terminalArgs
if ($LASTEXITCODE -ne 0) { throw "Terminal-challenge build failed with exit code $LASTEXITCODE" }

Write-Output (ConvertTo-Json -Compress @{
  ok = $true
  pdf_root = [IO.Path]::GetFullPath($pdfRoot)
  output_root = [IO.Path]::GetFullPath($OutputRoot)
  terminal_output_root = [IO.Path]::GetFullPath($TerminalOutputRoot)
  count = $Count
  recent = $RecentCount
  older = $Count - $RecentCount
})
