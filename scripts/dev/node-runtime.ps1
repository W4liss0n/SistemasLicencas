$ErrorActionPreference = 'Stop'

$script:WorkspaceNodeRoot = Join-Path $env:LOCALAPPDATA 'Programs\node-v22.22.2-win-x64'

function Get-WorkspaceNodeRoot {
  return $script:WorkspaceNodeRoot
}

function Test-WorkspaceNodeInstalled {
  $nodePath = Join-Path (Get-WorkspaceNodeRoot) 'node.exe'
  return Test-Path $nodePath
}

function Get-WorkspaceNodePath {
  if (Test-WorkspaceNodeInstalled) {
    return (Join-Path (Get-WorkspaceNodeRoot) 'node.exe')
  }

  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw 'Node.js nao encontrado no runtime local nem no PATH.'
}

function Get-WorkspaceNpmPath {
  if (Test-WorkspaceNodeInstalled) {
    return (Join-Path (Get-WorkspaceNodeRoot) 'npm.cmd')
  }

  $command = Get-Command npm -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw 'npm nao encontrado no runtime local nem no PATH.'
}

function Use-WorkspaceNode {
  if (-not (Test-WorkspaceNodeInstalled)) {
    Write-Host "[workspace-node] runtime local ausente em $(Get-WorkspaceNodeRoot); usando PATH atual."
    return $false
  }

  $nodeRoot = Get-WorkspaceNodeRoot
  $pathEntries = @($env:Path -split ';' | Where-Object { $_ })
  $remainingEntries = @($pathEntries | Where-Object { $_ -ne $nodeRoot })
  $env:Path = (@($nodeRoot) + $remainingEntries) -join ';'

  Write-Host "[workspace-node] usando runtime local: $nodeRoot"
  Write-Host "[workspace-node] node=$(& (Get-WorkspaceNodePath) -v)"
  Write-Host "[workspace-node] npm=$(& (Get-WorkspaceNpmPath) -v)"
  return $true
}
