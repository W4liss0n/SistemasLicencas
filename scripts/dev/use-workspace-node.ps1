$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

. (Join-Path $scriptDir 'node-runtime.ps1')

$usingLocalRuntime = Use-WorkspaceNode

if ($usingLocalRuntime) {
  Write-Host '[workspace-node] sessao atual pronta para os comandos do projeto.'
  Write-Host '[workspace-node] exemplo: npm run api:test'
} else {
  Write-Host '[workspace-node] siga com o Node atual e declare a limitacao se ele divergir da CI.'
}
