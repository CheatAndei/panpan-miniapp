[CmdletBinding()]
param(
  [string]$SourceRoot = 'E:\teach\(真题)广州8上数学',
  [string]$PackageRoot = '',
  [string]$WorkingRoot = '',
  [string]$PythonExe = '',
  [int]$ChoiceCount = 1000,
  [int]$RecentCount = 500,
  [int]$RecentFrom = 2024,
  [int]$StopAfterStep = 0,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = [IO.Path]::GetFullPath((Join-Path $scriptRoot '..'))
$repoRoot = [IO.Path]::GetFullPath((Join-Path $backendRoot '..'))
if ([string]::IsNullOrWhiteSpace($PackageRoot)) {
  $PackageRoot = Join-Path $backendRoot 'resources\choice-king\g8-source-pack'
}
if ([string]::IsNullOrWhiteSpace($WorkingRoot)) {
  $WorkingRoot = Join-Path $repoRoot 'z-rubbish\panpan-g8-exam-bank'
}
if ([string]::IsNullOrWhiteSpace($PythonExe)) {
  $PythonExe = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
}

$SourceRoot = [IO.Path]::GetFullPath($SourceRoot)
$PackageRoot = [IO.Path]::GetFullPath($PackageRoot)
$WorkingRoot = [IO.Path]::GetFullPath($WorkingRoot)
$PythonExe = [IO.Path]::GetFullPath($PythonExe)
if (-not (Test-Path -LiteralPath $SourceRoot -PathType Container)) { throw "Source root missing: $SourceRoot" }
if (-not (Test-Path -LiteralPath $PythonExe -PathType Leaf)) { throw "Python missing: $PythonExe" }

$taskId = 'panpan-g8-exam-source-pack-v1'
$statePath = Join-Path $WorkingRoot 'task-state.json'
$checkpointRoot = Join-Path $WorkingRoot 'checkpoints'
$logPath = Join-Path $WorkingRoot 'task.log'
$progressPath = Join-Path $repoRoot 'CODEX_PROGRESS.md'
$examManifest = Join-Path $PackageRoot 'exam-manifest.json'
$auditRoot = Join-Path $PackageRoot 'audit'
$manifestReview = Join-Path $auditRoot 'manifest-review.json'
$choiceRoot = Join-Path $PackageRoot 'choice'
$terminalRoot = Join-Path $PackageRoot 'terminal'
$scopeCatalog = Join-Path $PackageRoot 'scope-catalog.json'
$classificationReview = Join-Path $auditRoot 'classification-review.json'
$auditReport = Join-Path $auditRoot 'audit-report.json'
$pdfRoot = Join-Path $WorkingRoot 'pdfs'
$pdfAuditReport = Join-Path $WorkingRoot 'pdf-quality-report.json'
$contactRoot = Join-Path $WorkingRoot 'contact-sheets'

New-Item -ItemType Directory -Force -Path $WorkingRoot,$checkpointRoot,$PackageRoot,$auditRoot | Out-Null

function Save-JsonAtomic {
  param([string]$Path,[object]$Value)
  $temporary = "$Path.tmp"
  $Value | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $temporary -Encoding UTF8
  Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Write-TaskLog {
  param([string]$Level,[string]$Message)
  $line = '{0} [{1}] {2}' -f [DateTimeOffset]::Now.ToString('o'),$Level,$Message
  Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
  Write-Host $line
}

$steps = @(
  [pscustomobject]@{ id='manifest'; description='扫描、配对、哈希并生成 G8 试卷清单' },
  [pscustomobject]@{ id='pdf-export'; description='只读转换原卷和解析为 PDF' },
  [pscustomobject]@{ id='pdf-audit'; description='按七年级流程质检全部 PDF' },
  [pscustomobject]@{ id='choice'; description='拆分 1000 道客观题' },
  [pscustomobject]@{ id='terminal'; description='拆分每卷最后填空和最后两道大题' },
  [pscustomobject]@{ id='classify'; description='映射八上范围并补齐来源字段' },
  [pscustomobject]@{ id='verify'; description='校验数量、图片、范围与来源' }
)

function Save-Progress {
  param([object]$State)
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add('# Panpan 八上真题拆分进度')
  $lines.Add('')
  $lines.Add("- 任务：$taskId")
  $lines.Add("- 状态：$($State.status)")
  $lines.Add("- 更新时间：$([DateTimeOffset]::Now.ToString('o'))")
  $lines.Add("- 源目录：$SourceRoot")
  $lines.Add("- 题包目录：$PackageRoot")
  $lines.Add("- 日志：$logPath")
  $lines.Add('')
  $lines.Add('## 原子步骤')
  $lines.Add('')
  foreach ($step in $steps) {
    $mark = if (@($State.completed_steps) -contains $step.id) { 'x' } else { ' ' }
    $lines.Add(('- [{0}] `{1}` {2}' -f $mark,$step.id,$step.description))
  }
  $lines.Add('')
  $lines.Add('## 安全边界')
  $lines.Add('')
  $lines.Add('- 不写数据库，不改前端，不部署。')
  $lines.Add('- E 盘题源只读。')
  $lines.Add('- 不触碰打卡历史修复相关文件。')
  Set-Content -LiteralPath $progressPath -Value $lines -Encoding UTF8
}

if (Test-Path -LiteralPath $statePath) {
  $state = Get-Content -Raw -Encoding UTF8 -LiteralPath $statePath | ConvertFrom-Json
} else {
  $state = [pscustomobject]@{
    schema_version = 1
    task_id = $taskId
    status = 'pending'
    completed_steps = @()
    current_step = ''
    created_at = [DateTimeOffset]::Now.ToString('o')
    updated_at = [DateTimeOffset]::Now.ToString('o')
    failure = ''
  }
  Save-JsonAtomic -Path $statePath -Value $state
}

function Save-State {
  $state.updated_at = [DateTimeOffset]::Now.ToString('o')
  Save-JsonAtomic -Path $statePath -Value $state
  Save-Progress -State $state
}

function Assert-ExitCode {
  param([string]$Label)
  if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE" }
}

function Invoke-Step {
  param(
    [string]$Id,
    [string]$Description,
    [scriptblock]$Action
  )
  $checkpoint = Join-Path $checkpointRoot "$Id.completed.json"
  if ((@($state.completed_steps) -contains $Id) -and (Test-Path -LiteralPath $checkpoint)) {
    Write-TaskLog -Level INFO -Message "跳过已完成步骤：$Id"
    return $false
  }
  $state.status = 'running'
  $state.current_step = $Id
  $state.failure = ''
  Save-State
  Write-TaskLog -Level INFO -Message "开始步骤：$Id - $Description"
  try {
    & $Action | ForEach-Object { Write-Host ([string]$_) }
    Save-JsonAtomic -Path $checkpoint -Value ([pscustomobject]@{
      task_id = $taskId
      step_id = $Id
      completed_at = [DateTimeOffset]::Now.ToString('o')
      exit_code = 0
    })
    $state.completed_steps = @(@($state.completed_steps) + $Id)
    $state.current_step = ''
    Save-State
    Write-TaskLog -Level INFO -Message "完成步骤：$Id"
    return $true
  } catch {
    $state.status = 'failed'
    $state.failure = $_.Exception.Message
    Save-State
    Write-TaskLog -Level ERROR -Message "步骤失败：$Id - $($_.Exception.Message)"
    throw
  }
}

$completedThisRun = 0
foreach ($step in $steps) {
  $action = switch ($step.id) {
    'manifest' {
      {
        & $PythonExe (Join-Path $scriptRoot 'build-g8-exam-manifest.py') `
          --source-root $SourceRoot --output $examManifest --review-output $manifestReview
        Assert-ExitCode -Label 'G8 manifest build'
      }
    }
    'pdf-export' {
      {
        $params = @{
          SourceRoot = $SourceRoot
          ManifestPath = $examManifest
          OutputRoot = $pdfRoot
          Mode = 'both'
          Strict = $true
        }
        if ($Force) { $params.Force = $true }
        & (Join-Path $scriptRoot 'export-wps-pdf-batch.ps1') @params
        if (-not $?) { throw 'PDF export failed' }
      }
    }
    'pdf-audit' {
      {
        & $PythonExe (Join-Path $scriptRoot 'verify-exam-pdfs.py') `
          --manifest $examManifest --pdf-root $pdfRoot --output $pdfAuditReport `
          --replacement-glyphs-warning
        Assert-ExitCode -Label 'G8 PDF audit'
      }
    }
    'choice' {
      {
        $args = @(
          (Join-Path $scriptRoot 'build-choice-king-bank.py'),
          '--exam-manifest', $examManifest,
          '--pdf-root', $pdfRoot,
          '--output', $choiceRoot,
          '--count', [string]$ChoiceCount,
          '--recent-count', [string]$RecentCount,
          '--recent-from', [string]$RecentFrom
        )
        if ($Force) { $args += '--force' }
        & $PythonExe @args
        Assert-ExitCode -Label 'G8 choice build'
      }
    }
    'terminal' {
      {
        $args = @(
          (Join-Path $scriptRoot 'build-terminal-challenges.py'),
          '--exam-manifest', $examManifest,
          '--pdf-root', $pdfRoot,
          '--output', $terminalRoot
        )
        if ($Force) { $args += '--force' }
        & $PythonExe @args
        Assert-ExitCode -Label 'G8 terminal build'
      }
    }
    'classify' {
      {
        & $PythonExe (Join-Path $scriptRoot 'classify-g8-exam-source-pack.py') `
          --exam-manifest $examManifest `
          --choice-manifest (Join-Path $choiceRoot 'manifest.json') `
          --terminal-manifest (Join-Path $terminalRoot 'manifest.json') `
          --scope-output $scopeCatalog `
          --review-output $classificationReview
        Assert-ExitCode -Label 'G8 scope classification'
      }
    }
    'verify' {
      {
        & $PythonExe (Join-Path $scriptRoot 'verify-g8-exam-source-pack.py') `
          --exam-manifest $examManifest `
          --choice-root $choiceRoot `
          --terminal-root $terminalRoot `
          --scope-catalog $scopeCatalog `
          --classification-review $classificationReview `
          --audit-output $auditReport `
          --contact-output $contactRoot `
          --choice-count $ChoiceCount `
          --recent-count $RecentCount
        Assert-ExitCode -Label 'G8 source-pack verification'
      }
    }
  }
  if (Invoke-Step -Id $step.id -Description $step.description -Action $action) {
    $completedThisRun += 1
    if ($StopAfterStep -gt 0 -and $completedThisRun -ge $StopAfterStep) {
      $state.status = 'interrupted'
      Save-State
      Write-TaskLog -Level WARN -Message '按 StopAfterStep 中断；再次运行将从检查点继续。'
      exit 75
    }
  }
}

$state.status = 'completed'
$state.current_step = ''
$state.failure = ''
if ($null -eq $state.PSObject.Properties['ended_at']) {
  $state | Add-Member -NotePropertyName ended_at -NotePropertyValue ([DateTimeOffset]::Now.ToString('o'))
} else {
  $state.ended_at = [DateTimeOffset]::Now.ToString('o')
}
Save-State
Write-TaskLog -Level INFO -Message "任务完成：$taskId"
Write-Output (ConvertTo-Json -Compress @{
  ok = $true
  package_root = $PackageRoot
  working_root = $WorkingRoot
  audit_report = $auditReport
})
