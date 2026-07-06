param(
  [string]$PostmanApiKey = $env:POSTMAN_API_KEY,

  [string]$CollectionUid = "",

  [string]$CollectionUrl = "",

  [string]$SourcePath = "postman/VMS_API.postman_collection.json",

  [string]$BackupDirectory = "postman/backups",

  [switch]$SkipBackup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-CollectionUidFromUrl {
  param([string]$Url)

  if ([string]::IsNullOrWhiteSpace($Url)) {
    return ""
  }

  if ($Url -match '/collection/([^/?]+)') {
    return $Matches[1]
  }

  if ($Url -match 'collectionId=([^&]+)') {
    return [System.Uri]::UnescapeDataString($Matches[1])
  }

  return ""
}

if ([string]::IsNullOrWhiteSpace($PostmanApiKey)) {
  throw "Missing Postman API key. Pass -PostmanApiKey or set POSTMAN_API_KEY."
}

if ([string]::IsNullOrWhiteSpace($CollectionUid)) {
  $CollectionUid = Get-CollectionUidFromUrl $CollectionUrl
}

if ([string]::IsNullOrWhiteSpace($CollectionUid)) {
  throw "Missing collection UID. Pass -CollectionUid or -CollectionUrl."
}

if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "Collection file not found: $SourcePath"
}

$collection = Get-Content -LiteralPath $SourcePath -Raw | ConvertFrom-Json
$payload = @{ collection = $collection } | ConvertTo-Json -Depth 100
$headers = @{
  "X-API-Key" = $PostmanApiKey
  "Content-Type" = "application/json"
}

$endpoint = "https://api.getpostman.com/collections/$CollectionUid"

if (-not $SkipBackup) {
  if (-not (Test-Path -LiteralPath $BackupDirectory)) {
    New-Item -ItemType Directory -Path $BackupDirectory | Out-Null
  }

  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backupPath = Join-Path $BackupDirectory "$CollectionUid-$timestamp.backup.json"
  $currentCollection = Invoke-RestMethod -Method Get -Uri $endpoint -Headers $headers
  $currentCollection | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $backupPath -Encoding UTF8
  Write-Output "Backup saved: $backupPath"
}

Invoke-RestMethod -Method Put -Uri $endpoint -Headers $headers -Body $payload | Out-Null
Write-Output "Updated Postman collection: $CollectionUid"
