param(
  [string]$MarkdownPath = (Join-Path $PSScriptRoot "..\PROJECT_REPORT.md"),
  [string]$OutputPath = (Join-Path $PSScriptRoot "..\PROJECT_REPORT.docx")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )

  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }

  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Escape-XmlText {
  param([string]$Text)

  if ($null -eq $Text) { return "" }

  $escaped = [System.Security.SecurityElement]::Escape($Text)
  return $escaped -replace "`r?`n", " "
}

function New-ParagraphXml {
  param(
    [string]$Text,
    [string]$Style = ""
  )

  $escaped = Escape-XmlText $Text
  $pPr = ""
  if ($Style) {
    $pPr = "<w:pPr><w:pStyle w:val=`"$Style`"/></w:pPr>"
  }

  if ([string]::IsNullOrWhiteSpace($escaped)) {
    return "<w:p>$pPr</w:p>"
  }

  return "<w:p>$pPr<w:r><w:t xml:space=`"preserve`">$escaped</w:t></w:r></w:p>"
}

function Add-BufferedParagraph {
  param(
    [System.Collections.Generic.List[object]]$Paragraphs,
    [ref]$Buffer
  )

  if (-not [string]::IsNullOrWhiteSpace($Buffer.Value)) {
    $Paragraphs.Add([pscustomobject]@{
      Style = ""
      Text  = $Buffer.Value.Trim()
    })
    $Buffer.Value = ""
  }
}

if (-not (Test-Path $MarkdownPath)) {
  throw "Markdown file not found: $MarkdownPath"
}

$raw = Get-Content -LiteralPath $MarkdownPath -Raw
$lines = $raw -split "`r?`n"
$paragraphs = New-Object 'System.Collections.Generic.List[object]'
$buffer = ""

foreach ($line in $lines) {
  $trimmed = $line.Trim()

  if ($trimmed -eq "") {
    Add-BufferedParagraph -Paragraphs $paragraphs -Buffer ([ref]$buffer)
    continue
  }

  if ($trimmed -match '^---+$') {
    Add-BufferedParagraph -Paragraphs $paragraphs -Buffer ([ref]$buffer)
    continue
  }

  if ($trimmed -match '^# (.+)$') {
    Add-BufferedParagraph -Paragraphs $paragraphs -Buffer ([ref]$buffer)
    $paragraphs.Add([pscustomobject]@{ Style = "Heading1"; Text = $matches[1].Trim() })
    continue
  }

  if ($trimmed -match '^## (.+)$') {
    Add-BufferedParagraph -Paragraphs $paragraphs -Buffer ([ref]$buffer)
    $paragraphs.Add([pscustomobject]@{ Style = "Heading2"; Text = $matches[1].Trim() })
    continue
  }

  if ($trimmed -match '^### (.+)$') {
    Add-BufferedParagraph -Paragraphs $paragraphs -Buffer ([ref]$buffer)
    $paragraphs.Add([pscustomobject]@{ Style = "Heading3"; Text = $matches[1].Trim() })
    continue
  }

  if ($trimmed -match '^[-*] (.+)$') {
    Add-BufferedParagraph -Paragraphs $paragraphs -Buffer ([ref]$buffer)
    $paragraphs.Add([pscustomobject]@{ Style = ""; Text = "• " + $matches[1].Trim() })
    continue
  }

  if ($trimmed -match '^\d+\.\s+(.+)$') {
    Add-BufferedParagraph -Paragraphs $paragraphs -Buffer ([ref]$buffer)
    $paragraphs.Add([pscustomobject]@{ Style = ""; Text = $trimmed })
    continue
  }

  if ($trimmed.StartsWith("|") -and $trimmed.EndsWith("|")) {
    Add-BufferedParagraph -Paragraphs $paragraphs -Buffer ([ref]$buffer)
    if ($trimmed -notmatch '^\|(?:\s*:?-{3,}:?\s*\|)+$') {
      $cells = $trimmed.Trim("|").Split("|") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
      if ($cells.Count -gt 0) {
        $paragraphs.Add([pscustomobject]@{
          Style = ""
          Text  = ($cells -join " | ")
        })
      }
    }
    continue
  }

  if ($buffer) {
    $buffer += " " + $trimmed
  } else {
    $buffer = $trimmed
  }
}

Add-BufferedParagraph -Paragraphs $paragraphs -Buffer ([ref]$buffer)

$docParagraphs = foreach ($p in $paragraphs) {
  New-ParagraphXml -Text $p.Text -Style $p.Style
}

$documentXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
 xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
 xmlns:v="urn:schemas-microsoft-com:vml"
 xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:w10="urn:schemas-microsoft-com:office:word"
 xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
 xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
 xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
 xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
 xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
 mc:Ignorable="w14 wp14">
  <w:body>
    $($docParagraphs -join "`n    ")
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>
"@

$stylesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:sz w:val="22"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:uiPriority w:val="9"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="240" w:after="120"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:uiPriority w:val="9"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="180" w:after="80"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="28"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:uiPriority w:val="9"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="120" w:after="40"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
</w:styles>
"@

$contentTypesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"@

$rootRelsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"@

$documentRelsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"@

$timestamp = [DateTime]::UtcNow.ToString("s") + "Z"
$coreXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>ResumePortal Project Report</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">$timestamp</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$timestamp</dcterms:modified>
</cp:coreProperties>
"@

$appXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office Word</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <Company></Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>
"@

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$outputDir = Split-Path -Parent $resolvedOutput
if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$tempRoot = Join-Path $outputDir ("docx_build_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tempRoot "_rels") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tempRoot "docProps") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tempRoot "word") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tempRoot "word\_rels") | Out-Null

try {
  Write-Utf8NoBom -Path (Join-Path $tempRoot "[Content_Types].xml") -Content $contentTypesXml
  Write-Utf8NoBom -Path (Join-Path $tempRoot "_rels\.rels") -Content $rootRelsXml
  Write-Utf8NoBom -Path (Join-Path $tempRoot "docProps\core.xml") -Content $coreXml
  Write-Utf8NoBom -Path (Join-Path $tempRoot "docProps\app.xml") -Content $appXml
  Write-Utf8NoBom -Path (Join-Path $tempRoot "word\document.xml") -Content $documentXml
  Write-Utf8NoBom -Path (Join-Path $tempRoot "word\styles.xml") -Content $stylesXml
  Write-Utf8NoBom -Path (Join-Path $tempRoot "word\_rels\document.xml.rels") -Content $documentRelsXml

  if (Test-Path $resolvedOutput) {
    Remove-Item -LiteralPath $resolvedOutput -Force
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory($tempRoot, $resolvedOutput)

  Write-Output "Created: $resolvedOutput"
}
finally {
  if (Test-Path $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
