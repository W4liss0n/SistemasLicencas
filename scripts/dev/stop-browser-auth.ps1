$ErrorActionPreference = 'SilentlyContinue'

function Stop-ByPort {
  param(
    [int]$Port
  )

  $connections = @()
  try {
    $connections = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop)
  } catch {
    return
  }

  $processIds = $connections |
    Select-Object -ExpandProperty OwningProcess -Unique |
    Where-Object { $_ -gt 0 }

  foreach ($processId in $processIds) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Write-Host "[stop-auth] stopped pid $processId on port $Port"
  }
}

Stop-ByPort -Port 3001
Stop-ByPort -Port 4010

Write-Host "[stop-auth] done."
