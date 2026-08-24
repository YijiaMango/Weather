# Agent 回合結束：有改動就 commit + push。不要背景迴圈。
$ErrorActionPreference = "Continue"
try { $null = [Console]::In.ReadToEnd() } catch {}

$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location -LiteralPath $repo

if (-not (Test-Path -LiteralPath (Join-Path $repo ".git"))) {
  Write-Output '{}'
  exit 0
}

$porcelain = git status --porcelain
$sb = git status -sb
$ahead = $sb -match "ahead"

if (-not $porcelain -and -not $ahead) {
  Write-Output '{}'
  exit 0
}

$pub = Join-Path $repo "publish.ps1"
if (Test-Path -LiteralPath $pub) {
  & $pub -Message "Auto-publish Weather update."
} else {
  $env:GIT_AUTHOR_NAME = "QinHuang"
  $env:GIT_AUTHOR_EMAIL = "52860923+YijiaMango@users.noreply.github.com"
  $env:GIT_COMMITTER_NAME = $env:GIT_AUTHOR_NAME
  $env:GIT_COMMITTER_EMAIL = $env:GIT_AUTHOR_EMAIL
  git add -u
  if ($porcelain) { git commit -m "Auto-publish Weather update." }
  git push origin HEAD
}

Write-Output '{}'
exit 0
