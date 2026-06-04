param(
  [switch]$SkipInstall,
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "未找到 npm，请先安装 Node.js（包含 npm）后再运行。"
}

if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $PSScriptRoot "node_modules"))) {
  Write-Host "检测到未安装依赖，正在执行 npm install..."
  npm install
}

$env:PORT = "$Port"
Write-Host "正在启动服务: http://localhost:$Port"
npm start
