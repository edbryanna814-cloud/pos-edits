# Gate 1 S6: stage the pinned MongoDB runtime for the installer (vendor\mongodb -> resources\mongodb).
# Ships mongod.exe and the VC++ runtime it needs. Not shipped from Server\<ver>\bin: mongos.exe (sharding
# router, unused), *.pdb (debug symbols), mongod.cfg (the dev service config) and InstallCompass.ps1.
param([string]$Version = '9.0.8')

$ErrorActionPreference = 'Stop'

$folder = Join-Path $PSScriptRoot '..\vendor\mongodb'
$target = Join-Path $folder 'mongod.exe'
New-Item -ItemType Directory -Force -Path $folder | Out-Null

function Get-MongodVersion([string]$exe) {
  $out = (& $exe --version 2>$null) | Out-String
  if ($out -match 'db version v(\d+\.\d+\.\d+)') { return $Matches[1] }
  return $null
}

# A stale vendored copy of another version is replaced, never shipped.
if ((Test-Path $target) -and ((Get-MongodVersion $target) -ne $Version)) { Remove-Item $target -Force }

if (-not (Test-Path $target)) {
  $source = Get-ChildItem 'C:\Program Files\MongoDB\Server' -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName 'bin\mongod.exe' } |
    Where-Object { (Test-Path $_) -and ((Get-MongodVersion $_) -eq $Version) } |
    Select-Object -First 1

  if (-not $source) {
    throw "mongod.exe $Version not found. Install MongoDB Community Server $Version or place it at vendor\mongodb\mongod.exe."
  }

  Copy-Item $source $target
  Write-Output "Copied $source"
}

$actual = Get-MongodVersion $target
if ($actual -ne $Version) { throw "vendor\mongodb\mongod.exe is '$actual'; the pinned version is $Version." }

$runtime = 'vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll', 'msvcp140_1.dll', 'msvcp140_2.dll', 'msvcp140_atomic_wait.dll', 'msvcp140_codecvt_ids.dll', 'concrt140.dll'
foreach ($name in $runtime) {
  $source = Join-Path $env:SystemRoot "System32\$name"
  $destination = Join-Path $folder $name
  if ((Test-Path $source) -and -not (Test-Path $destination)) {
    Copy-Item $source $destination
  }
}
foreach ($required in 'vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll') {
  if (-not (Test-Path (Join-Path $folder $required))) { throw "Missing VC++ runtime $required in vendor\mongodb." }
}

$hash = (Get-FileHash $target -Algorithm SHA256).Hash
Write-Output "MongoDB $actual runtime is ready in vendor\mongodb (mongod.exe SHA-256 $hash)."
