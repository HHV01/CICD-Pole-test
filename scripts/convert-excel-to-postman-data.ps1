param(
  [Parameter(Mandatory = $true)]
  [string]$ExcelPath,

  [Parameter(Mandatory = $true)]
  [string]$SheetName,

  [string]$OutputPath = "postman/data/generated_cases.json",

  [int]$HeaderRow = 11,

  [int]$StartRow = 12,

  [string]$MethodFilter = "",

  [string]$PathFilter = "",

  [int]$MaxRows = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-ZipText {
  param($ZipFile, [string]$Name)

  $entry = $ZipFile.Entries | Where-Object { $_.FullName -eq $Name } | Select-Object -First 1
  if (-not $entry) {
    return $null
  }

  $reader = [System.IO.StreamReader]::new($entry.Open())
  try {
    return $reader.ReadToEnd()
  }
  finally {
    $reader.Dispose()
  }
}

function Get-ColIndex {
  param([string]$CellRef)

  if ($CellRef -notmatch '^([A-Z]+)') {
    return 1
  }

  $index = 0
  foreach ($char in $Matches[1].ToCharArray()) {
    $index = ($index * 26) + ([int][char]$char - [int][char]'A' + 1)
  }

  return $index
}

function Get-CellValue {
  param($Cell, [System.Collections.Generic.List[string]]$SharedStrings)

  $type = $Cell.GetAttribute("t")
  $valueNode = @($Cell.GetElementsByTagName("v")) | Select-Object -First 1
  $valueText = if ($valueNode) { [string]$valueNode.InnerText } else { "" }

  if ($type -eq "s") {
    $rawIndex = $valueText
    if ([string]::IsNullOrWhiteSpace($rawIndex)) {
      return ""
    }

    $index = [int]$rawIndex
    if ($index -ge 0 -and $index -lt $SharedStrings.Count) {
      return $SharedStrings[$index]
    }

    return ""
  }

  if ($type -eq "inlineStr") {
    $texts = @($Cell.GetElementsByTagName("t") | ForEach-Object { $_.InnerText })
    return ($texts -join "")
  }

  if (-not [string]::IsNullOrWhiteSpace($valueText)) {
    return $valueText
  }

  return ""
}

function Convert-InputData {
  param([string]$InputData)

  if ([string]::IsNullOrWhiteSpace($InputData)) {
    return $null
  }

  $trimmed = $InputData.Trim()
  if ($trimmed.StartsWith("{") -or $trimmed.StartsWith("[")) {
    try {
      return ($trimmed | ConvertFrom-Json -ErrorAction Stop)
    }
    catch {
      return $trimmed
    }
  }

  return $trimmed
}

function Get-ExpectedStatus {
  param([string]$Expected)

  if ([string]::IsNullOrWhiteSpace($Expected)) {
    return $null
  }

  if ($Expected -match 'Status\s*:\s*(\d{3})') {
    return [int]$Matches[1]
  }

  if ($Expected -match '\b(\d{3})\b') {
    return [int]$Matches[1]
  }

  return $null
}

function Get-ExpectedMessage {
  param([string]$Expected)

  if ([string]::IsNullOrWhiteSpace($Expected)) {
    return ""
  }

  if ($Expected -match '"en"\s*:\s*"([^"]+)"') {
    return $Matches[1]
  }

  if ($Expected -match '"vi"\s*:\s*"([^"]+)"') {
    return $Matches[1]
  }

  return ""
}

function Get-CanonicalHeader {
  param([string]$Header)

  switch -Regex ($Header) {
    'Scenario ID' { return "scenarioId" }
    'Test Scenario Title' { return "scenarioTitle" }
    'Test case ID' { return "caseId" }
    'Test Case Description' { return "description" }
    'Pre-Conditions' { return "preConditions" }
    'Test step' { return "testStep" }
    'Method' { return "method" }
    'Path' { return "path" }
    'Input data' { return "body" }
    'Expected Results' { return "expectedRaw" }
    'Actual Results' { return "actualRaw" }
    'Status' { return "excelStatus" }
    'Notes' { return "notes" }
    default { return "" }
  }
}

if (-not (Test-Path -LiteralPath $ExcelPath)) {
  throw "Excel file not found: $ExcelPath"
}

$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ExcelPath))

try {
  $sharedStrings = [System.Collections.Generic.List[string]]::new()
  $sharedText = Read-ZipText $zip "xl/sharedStrings.xml"
  if ($sharedText) {
    [xml]$sharedXml = $sharedText
    foreach ($item in $sharedXml.GetElementsByTagName("si")) {
      $texts = @($item.GetElementsByTagName("t") | ForEach-Object { $_.InnerText })
      [void]$sharedStrings.Add(($texts -join ""))
    }
  }

  [xml]$workbook = Read-ZipText $zip "xl/workbook.xml"
  [xml]$relsXml = Read-ZipText $zip "xl/_rels/workbook.xml.rels"

  $relations = @{}
  foreach ($relation in $relsXml.Relationships.Relationship) {
    $relations[$relation.Id] = $relation.Target
  }

  $sheet = @($workbook.GetElementsByTagName("sheet")) |
    Where-Object { $_.GetAttribute("name") -eq $SheetName } |
    Select-Object -First 1

  if (-not $sheet) {
    throw "Sheet not found: $SheetName"
  }

  $relationshipId = $sheet.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
  $target = $relations[$relationshipId]
  $sheetPath = if ($target.StartsWith("/")) { $target.TrimStart("/") } else { "xl/$target" }
  $sheetPath = $sheetPath -replace 'xl/worksheets/\.\./', 'xl/'

  [xml]$worksheet = Read-ZipText $zip $sheetPath
  $rows = @($worksheet.GetElementsByTagName("row"))

  $headers = @{}
  $current = @{
    scenarioId = ""
    scenarioTitle = ""
    method = ""
    path = ""
  }
  $cases = @()

  foreach ($row in $rows) {
    $rowNumber = [int]$row.GetAttribute("r")
    $values = @{}

    foreach ($cell in @($row.GetElementsByTagName("c"))) {
      $values[(Get-ColIndex $cell.GetAttribute("r"))] = (Get-CellValue $cell $sharedStrings)
    }

    if ($rowNumber -eq $HeaderRow) {
      foreach ($index in $values.Keys) {
        $canonical = Get-CanonicalHeader ([string]$values[$index])
        if ($canonical) {
          $headers[$index] = $canonical
        }
      }
      continue
    }

    if ($rowNumber -lt $StartRow) {
      continue
    }

    $record = @{}
    foreach ($index in $headers.Keys) {
      $key = $headers[$index]
      $record[$key] = if ($values.ContainsKey($index)) { [string]$values[$index] } else { "" }
    }

    if ([string]::IsNullOrWhiteSpace($record.caseId)) {
      continue
    }

    foreach ($stickyKey in @("scenarioId", "scenarioTitle", "method", "path")) {
      if (-not [string]::IsNullOrWhiteSpace($record[$stickyKey])) {
        $current[$stickyKey] = $record[$stickyKey]
      }
      else {
        $record[$stickyKey] = $current[$stickyKey]
      }
    }

    if ($MethodFilter -and ($record.method -ne $MethodFilter)) {
      continue
    }

    if ($PathFilter -and ($record.path -ne $PathFilter)) {
      continue
    }

    $case = [ordered]@{
      caseId = $record.caseId
      scenarioId = $record.scenarioId
      scenarioTitle = $record.scenarioTitle
      description = $record.description
      method = $record.method
      path = $record.path
      body = Convert-InputData $record.body
      expectedStatus = Get-ExpectedStatus $record.expectedRaw
      expectedMessage = Get-ExpectedMessage $record.expectedRaw
      maxResponseTime = 200
      source = @{
        sheet = $SheetName
        row = $rowNumber
        excelStatus = $record.excelStatus
        notes = $record.notes
      }
    }

    $cases += [pscustomobject]$case

    if ($MaxRows -gt 0 -and $cases.Count -ge $MaxRows) {
      break
    }
  }

  $outputFullPath = Join-Path (Get-Location) $OutputPath
  $outputDirectory = Split-Path -Parent $outputFullPath
  if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
  }

  $cases | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $outputFullPath -Encoding UTF8
  Write-Output "Wrote $($cases.Count) cases to $OutputPath"
}
finally {
  $zip.Dispose()
}
