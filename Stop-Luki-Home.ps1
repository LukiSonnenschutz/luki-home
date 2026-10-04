$ErrorActionPreference = 'Stop'
$taskPidFile = Join-Path $PSScriptRoot 'data\server.json'
if (-not (Test-Path -LiteralPath $taskPidFile)) { Write-Host 'Kein verwalteter Hintergrundserver gefunden. Einen Start im Terminal mit Strg+C beenden.'; exit 0 }
$taskServerInfo = Get-Content -LiteralPath $taskPidFile -Raw | ConvertFrom-Json
$taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($taskServerInfo.pid)" -ErrorAction SilentlyContinue
$taskExpectedCli = Join-Path $PSScriptRoot 'scripts\serve.mjs'
if ($taskProcess -and $taskProcess.CommandLine -and $taskProcess.CommandLine.Contains($taskExpectedCli)) {
    Stop-Process -Id $taskServerInfo.pid
    Write-Host 'Luki Home wurde beendet. Deine Daten bleiben gespeichert.'
} elseif ($taskProcess) { throw 'Die gespeicherte Prozessnummer gehört inzwischen zu einem anderen Programm. Es wurde nichts beendet.' }
else { Write-Host 'Der Hintergrundserver läuft nicht mehr.' }
