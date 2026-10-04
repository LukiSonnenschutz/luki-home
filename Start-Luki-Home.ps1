$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$taskNode = Get-Command node -ErrorAction SilentlyContinue
if (-not $taskNode) {
    $taskBundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (-not (Test-Path -LiteralPath $taskBundledNode)) { throw 'Node.js 24 oder neuer wird benötigt.' }
    $taskNodePath = $taskBundledNode
} else { $taskNodePath = $taskNode.Source }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\next\dist\bin\next'))) { throw 'Abhängigkeiten fehlen. Bitte zuerst pnpm install ausführen.' }
Write-Host 'Luki Home startet auf http://127.0.0.1:3100 — mit Strg+C beenden.'
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.next\BUILD_ID')) {
    & $taskNodePath 'node_modules\next\dist\bin\next' start --hostname 127.0.0.1 --port 3100
} else {
    & $taskNodePath 'node_modules\next\dist\bin\next' dev --hostname 127.0.0.1 --port 3100
}
