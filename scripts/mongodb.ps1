param(
  [ValidateSet('start', 'stop', 'status', 'init')]
  [string]$Action = 'start'
)

$ErrorActionPreference = 'Stop'
$serviceName = 'MongoDB'
$logFile = 'C:\Program Files\MongoDB\Server\9.0\log\mongod.log'

function Get-MongoService {
  Get-Service -Name $serviceName -ErrorAction SilentlyContinue
}

switch ($Action) {
  'start' {
    try {
      Start-Service -Name $serviceName
      Write-Output 'MongoDB service started.'
    } catch {
      Write-Output "Could not start MongoDB. Run this from an elevated PowerShell. $($_.Exception.Message)"
    }
    break
  }

  'stop' {
    try {
      Stop-Service -Name $serviceName -Force
      Write-Output 'MongoDB service stopped.'
    } catch {
      Write-Output "Could not stop MongoDB. Run this from an elevated PowerShell. $($_.Exception.Message)"
    }
    break
  }

  'status' {
    $service = Get-MongoService
    if (-not $service) {
      Write-Output 'MongoDB service is not installed.'
      break
    }

    $listening = Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue
    Write-Output "MongoDB service: $($service.Status); startType=$($service.StartType); listening=$([bool]$listening); log=$logFile"
    break
  }

  'init' {
    Push-Location (Join-Path $PSScriptRoot '..')
    try {
      node -e "const {MongoClient}=require('mongodb'); (async()=>{const c=new MongoClient('mongodb://127.0.0.1:27017/?directConnection=true',{serverSelectionTimeoutMS:5000}); await c.connect(); const a=c.db('admin'); try{await a.command({replSetInitiate:{_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]}}); console.log('Replica set initiated.')}catch(e){if(e.codeName==='AlreadyInitialized'){console.log('Replica set already initialized.')}else{throw e}} for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,1000)); const h=await a.command({hello:1}); if(h.isWritablePrimary){console.log('PRIMARY',h.setName); break} if(i===29){console.log('NOT PRIMARY',JSON.stringify(h).slice(0,300))}} await c.close()})().catch(e=>{console.error(e);process.exit(1)})"
    } finally {
      Pop-Location
    }
    break
  }
}
