$ErrorActionPreference = 'Stop'

$folder = Join-Path $PSScriptRoot '..\vendor\mongodb'
$target = Join-Path $folder 'mongod.exe'
New-Item -ItemType Directory -Force -Path $folder | Out-Null

if (-not (Test-Path $target)) {
  $source = Get-ChildItem 'C:\Program Files\MongoDB\Server' -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName 'bin\mongod.exe' } |
    Where-Object { Test-Path $_ } |
    Select-Object -First 1

  if (-not $source) {
    throw 'mongod.exe not found. Install MongoDB Community Server or place it at vendor\mongodb\mongod.exe.'
  }

  Copy-Item $source $target
  Write-Output "Copied $source"
}

$runtime = 'vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll', 'msvcp140_1.dll', 'msvcp140_2.dll', 'msvcp140_atomic_wait.dll', 'msvcp140_codecvt_ids.dll', 'concrt140.dll'
foreach ($name in $runtime) {
  $source = Join-Path $env:SystemRoot "System32\$name"
  $destination = Join-Path $folder $name
  if ((Test-Path $source) -and -not (Test-Path $destination)) {
    Copy-Item $source $destination
  }
}

Write-Output 'MongoDB runtime is ready in vendor\mongodb.'
