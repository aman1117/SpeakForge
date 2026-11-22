# Starts SpeakForge on http://localhost:8765 and opens it in Microsoft Edge (speech recognition works in Edge/Chrome).
#   .\start.ps1                    start + open
#   .\start.ps1 -Reminder 20:00    also open SpeakForge automatically every day at 20:00 (Windows scheduled task)
#   .\start.ps1 -RemoveReminder    delete the daily reminder
param(
    [string]$Reminder,
    [switch]$RemoveReminder,
    [string]$TaskName = 'SpeakForge daily practice'
)
$ErrorActionPreference = 'Stop'
$port = 8765
Set-Location $PSScriptRoot

if ($RemoveReminder) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Reminder removed."
    return
}
if ($Reminder) {
    $at = [datetime]::ParseExact($Reminder, 'HH:mm', $null)
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    $trigger = New-ScheduledTaskTrigger -Daily -At $at
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Description 'Opens SpeakForge for your daily speaking practice' -Force | Out-Null
    Write-Host "Daily reminder set for $Reminder. Remove with: .\start.ps1 -RemoveReminder"
}

$listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
    Start-Process python -ArgumentList '-m', 'http.server', $port, '--bind', '127.0.0.1' -WindowStyle Hidden -WorkingDirectory $PSScriptRoot
    Start-Sleep -Seconds 1
}
Start-Process "msedge" "http://localhost:$port/"
Write-Host "SpeakForge running at http://localhost:$port/  (close the hidden python process to stop it)"
