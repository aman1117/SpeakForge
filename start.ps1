# Starts SpeakForge on http://localhost:8765 and opens it in Microsoft Edge (speech recognition works in Edge/Chrome).
$ErrorActionPreference = 'Stop'
$port = 8765
Set-Location $PSScriptRoot
$listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
    Start-Process python -ArgumentList '-m', 'http.server', $port, '--bind', '127.0.0.1' -WindowStyle Hidden -WorkingDirectory $PSScriptRoot
    Start-Sleep -Seconds 1
}
Start-Process "msedge" "http://localhost:$port/"
Write-Host "SpeakForge running at http://localhost:$port/  (close the hidden python process to stop it)"
