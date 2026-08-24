# YijiaMango Weather publish tool
# Usage: .\publish.ps1 [-Message "commit message"]
param(
  [string]$Message = "Publish YijiaMango Weather update."
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $repo

if (-not (Test-Path -LiteralPath (Join-Path $repo "weather-data\tw-topo.js"))) {
  throw "Missing weather-data/tw-topo.js"
}
if (-not (Test-Path -LiteralPath (Join-Path $repo "og.png"))) {
  Write-Warning "og.png missing — LINE preview image may be empty"
}

git add index.html cwa.js windy.js weather-data og.png README.md verify-publish.js publish.ps1 2>$null
git add -u
$status = git status --porcelain
if (-not $status) {
  Write-Host "Nothing to commit. Pushing current main..."
} else {
  $env:GIT_AUTHOR_NAME = "QinHuang"
  $env:GIT_AUTHOR_EMAIL = "52860923+YijiaMango@users.noreply.github.com"
  $env:GIT_COMMITTER_NAME = $env:GIT_AUTHOR_NAME
  $env:GIT_COMMITTER_EMAIL = $env:GIT_AUTHOR_EMAIL
  git commit -m $Message
}

git push origin HEAD
Write-Host ""
Write-Host "Published:"
Write-Host "  App  : https://yijiamango.github.io/Weather/"
Write-Host "  Share: https://yijiamango.github.io/Weather/?v=$(Get-Date -Format yyyyMMddHHmm)"
Write-Host ""
Write-Host "Run: node verify-publish.js   # check live OG / layout"
