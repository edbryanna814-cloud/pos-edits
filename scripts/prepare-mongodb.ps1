$ErrorActionPreference = 'Stop'

$target = Join-Path $PSScriptRoot '..\vendor\mongodb\mongod.exe'
if (Test-Path $target) {
  Write-Output 'mongod.exe already present.'
  exit 0
}

$source = Get-ChildItem 'C:\Program Files\MongoDB\Server' -Directory -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending |
  ForEach-Object { Join-Path $_.FullName 'bin\mongod.exe' } |
  Where-Object { Test-Path $_ } |
  Select-Object -First 1

if (-not $source) {
  throw 'mongod.exe not found. Install MongoDB Community Server or place it at vendor\mongodb\mongod.exe.'
}

New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
Copy-Item $source $target
Write-Output "Copied $source"
