param(
  [string]$ExcelPath = "",
  [string]$SheetName = "Rule Engine API",
  [string]$OutputPath = "postman/data/rule-engine-api-testcases.json",
  [int]$HeaderRow = 11,
  [int]$StartRow = 12
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-ZipText {
  param($ZipFile, [string]$Name)
  $entry = $ZipFile.Entries | Where-Object { $_.FullName -eq $Name } | Select-Object -First 1
  if (-not $entry) { return $null }
  $reader = [System.IO.StreamReader]::new($entry.Open())
  try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}

function Get-ColIndex {
  param([string]$CellRef)
  if ($CellRef -notmatch '^([A-Z]+)') { return 1 }
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
    if ([string]::IsNullOrWhiteSpace($valueText)) { return "" }
    $index = [int]$valueText
    if ($index -ge 0 -and $index -lt $SharedStrings.Count) { return $SharedStrings[$index] }
    return ""
  }
  if ($type -eq "inlineStr") {
    return (@($Cell.GetElementsByTagName("t") | ForEach-Object { $_.InnerText }) -join "")
  }
  return $valueText
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
    'Path' { return "path" }
    'Input data' { return "inputRaw" }
    'Expected Results' { return "expectedRaw" }
    'Actual Results' { return "actualRaw" }
    'Status' { return "excelStatus" }
    'Notes' { return "notes" }
    default { return "" }
  }
}

if ([string]::IsNullOrWhiteSpace($ExcelPath)) {
  $candidates = @(
    $env:RULE_ENGINE_EXCEL_PATH,
    "C:\Users\VNTT\Desktop\QC VNTT\pole\repo-exam\reports\rule-engine-api-testcases.xlsx",
    (Join-Path (Get-Location) "rule-engine-api-testcases.xlsx")
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

  $ExcelPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

if ([string]::IsNullOrWhiteSpace($ExcelPath)) {
  throw "Missing ExcelPath. Hay truyen duong dan file Excel bang tham so -ExcelPath, hoac set bien moi truong RULE_ENGINE_EXCEL_PATH."
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
      [void]$sharedStrings.Add((@($item.GetElementsByTagName("t") | ForEach-Object { $_.InnerText }) -join ""))
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
  if (-not $sheet) { throw "Sheet not found: $SheetName" }

  $relationshipId = $sheet.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
  $target = $relations[$relationshipId]
  $sheetPath = if ($target.StartsWith("/")) { $target.TrimStart("/") } else { "xl/$target" }
  $sheetPath = $sheetPath -replace 'xl/worksheets/\.\./', 'xl/'

  [xml]$worksheet = Read-ZipText $zip $sheetPath
  $headers = @{}
  $cases = @()

  foreach ($row in @($worksheet.GetElementsByTagName("row"))) {
    $rowNumber = [int]$row.GetAttribute("r")
    $values = @{}
    foreach ($cell in @($row.GetElementsByTagName("c"))) {
      $values[(Get-ColIndex $cell.GetAttribute("r"))] = Get-CellValue $cell $sharedStrings
    }

    if ($rowNumber -eq $HeaderRow) {
      foreach ($index in $values.Keys) {
        $canonical = Get-CanonicalHeader ([string]$values[$index])
        if ($canonical) { $headers[$index] = $canonical }
      }
      continue
    }
    if ($rowNumber -lt $StartRow) { continue }

    $record = [ordered]@{ sourceRow = $rowNumber }
    foreach ($index in $headers.Keys) {
      $record[$headers[$index]] = if ($values.ContainsKey($index)) { [string]$values[$index] } else { "" }
    }
    if (-not [string]::IsNullOrWhiteSpace($record.caseId)) {
      $cases += [pscustomobject]$record
    }
  }

  $outputFullPath = Join-Path (Get-Location) $OutputPath
  $outputDirectory = Split-Path -Parent $outputFullPath
  if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
  }
  $cases | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $outputFullPath -Encoding UTF8
  Write-Output "Wrote $($cases.Count) test cases to $OutputPath"
}
finally {
  $zip.Dispose()
}
