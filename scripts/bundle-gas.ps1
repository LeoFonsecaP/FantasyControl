# Gera AllInOne.gs — um único arquivo para colar no Apps Script
$root = Split-Path -Parent $PSScriptRoot
$gasDir = Join-Path $root "gas"
$outDir = Join-Path $gasDir "bundle"
$outFile = Join-Path $outDir "AllInOne.gs"

$order = @(
  "Config.gs",
  "Lock.gs",
  "Auth.gs",
  "Players.gs",
  "Picks.gs",
  "Trades.gs",
  "Keeps.gs",
  "Standings.gs",
  "Code.gs"
)

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("/**")
[void]$sb.AppendLine(" * Liga Dynasty - bundle gerado automaticamente.")
[void]$sb.AppendLine(" * Cole este arquivo inteiro em Extensoes -> Apps Script -> Codigo.gs")
[void]$sb.AppendLine(" * Regenerar: powershell -File scripts/bundle-gas.ps1")
[void]$sb.AppendLine(" */")
[void]$sb.AppendLine("")

foreach ($file in $order) {
  $path = Join-Path $gasDir $file
  if (-not (Test-Path $path)) {
    Write-Warning "Arquivo não encontrado: $file"
    continue
  }
  [void]$sb.AppendLine("")
  [void]$sb.AppendLine("// ========== $file ==========")
  [void]$sb.AppendLine("")
  [void]$sb.AppendLine((Get-Content $path -Raw -Encoding UTF8))
}

[System.IO.File]::WriteAllText($outFile, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))
Write-Host "Gerado: $outFile"
