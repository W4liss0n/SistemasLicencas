param(
  [switch]$SkipInfra,
  [switch]$SkipMockOidc
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspace = Resolve-Path (Join-Path $scriptDir '..\..')
Push-Location $workspace

function Wait-HttpReady {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 2 | Out-Null
      return
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  throw "Timeout waiting for $Url"
}

try {
  Write-Host "[prepare-auth] workspace: $(Get-Location)"
  Write-Host "[prepare-auth] stopping previous auth processes (if any)..."
  & (Join-Path $scriptDir 'stop-browser-auth.ps1') | Out-Host
  Start-Sleep -Milliseconds 300

  if (-not $SkipInfra) {
    Write-Host '[prepare-auth] starting postgres/redis...'
    docker compose up -d postgres redis | Out-Host
  }

  Write-Host '[prepare-auth] applying migrations...'
  npm run api:prisma:migrate:deploy | Out-Host

  Write-Host '[prepare-auth] seeding canonical data...'
  npm run api:prisma:seed | Out-Host

  New-Item -ItemType Directory -Force -Path '.tmp' | Out-Null
  $runId = Get-Date -Format 'yyyyMMdd-HHmmss'
  $mockOut = Join-Path '.tmp' "mock-oidc-out-$runId.log"
  $mockErr = Join-Path '.tmp' "mock-oidc-err-$runId.log"
  $apiOut = Join-Path '.tmp' "api-auth-out-$runId.log"
  $apiErr = Join-Path '.tmp' "api-auth-err-$runId.log"

  if (-not $SkipMockOidc) {
    Write-Host '[prepare-auth] starting mock OIDC provider...'
    $mock = Start-Process -FilePath node -ArgumentList 'scripts/dev/mock-oidc-provider.mjs' -WorkingDirectory '.' -PassThru -RedirectStandardOutput $mockOut -RedirectStandardError $mockErr
  } else {
    Write-Host '[prepare-auth] mock OIDC disabled (using external issuer from .env)'
  }

  Write-Host '[prepare-auth] starting backend API...'
  $api = Start-Process -FilePath cmd.exe -ArgumentList '/c', 'npm run api:dev' -WorkingDirectory '.' -PassThru -RedirectStandardOutput $apiOut -RedirectStandardError $apiErr

  if (-not $SkipMockOidc) {
    Wait-HttpReady -Url 'http://127.0.0.1:4010/.well-known/openid-configuration' -TimeoutSeconds 30
  }
  Wait-HttpReady -Url 'http://127.0.0.1:3001/api/v2/health' -TimeoutSeconds 45
  Wait-HttpReady -Url 'http://127.0.0.1:3001/api/v2/auth/oidc/config' -TimeoutSeconds 45

  Write-Host '[prepare-auth] ready.'
  if (-not $SkipMockOidc) {
    Write-Host "[prepare-auth] MOCK_PID=$($mock.Id)"
  }
  Write-Host "[prepare-auth] API_PID=$($api.Id)"
  Write-Host "[prepare-auth] logs: $mockOut, $mockErr, $apiOut, $apiErr"
  Write-Host '[prepare-auth] run smoke:'
  Write-Host '  cd sdk/python'
  Write-Host '  python examples/browser_login_smoke.py'
}
finally {
  Pop-Location
}