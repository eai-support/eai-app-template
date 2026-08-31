param(
  [ValidateSet("dev", "test", "prod")]
  [string]$Environment = "dev",
  [int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 3001 })
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if ($Port -lt 1 -or $Port -gt 65535) {
  throw "Invalid port: $Port"
}

function Get-PackageHash {
  $files = @("package.json", "package-lock.json") | Where-Object { Test-Path $_ }
  if ($files.Count -eq 0) {
    return "missing-package-files"
  }

  $hashInput = foreach ($file in $files) {
    $hash = Get-FileHash -Algorithm SHA256 -Path $file
    "$($hash.Hash.ToLowerInvariant())  $file"
  }

  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($hashInput -join "`n"))
  $sha = [System.Security.Cryptography.SHA256]::Create()
  return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
}

function Get-PortProcessIds {
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $connections) {
    return @()
  }

  return @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
}

function Stop-PortListener {
  Write-Host "Checking port $Port..."
  $processIds = Get-PortProcessIds

  if ($processIds.Count -eq 0) {
    Write-Host "Port $Port is free."
    return
  }

  Write-Host "Stopping process on port $Port: $($processIds -join ', ')"
  foreach ($processId in $processIds) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 1
}

$lastHashFile = ".last_package_hash"
$currentHash = Get-PackageHash
$lastHash = if (Test-Path $lastHashFile) { Get-Content $lastHashFile -Raw } else { "" }

if (-not (Test-Path "node_modules") -or $currentHash.Trim() -ne $lastHash.Trim()) {
  Write-Host "Installing dependencies..."
  npm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Set-Content -Path $lastHashFile -Value $currentHash
} else {
  Write-Host "Dependencies are up to date."
}

Write-Host "Building the app..."
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Stop-PortListener

Write-Host "Starting dev server on port $Port with environment: $Environment"
$env:PORT = [string]$Port
npm run "dev:$Environment"
exit $LASTEXITCODE
