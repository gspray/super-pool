# upload.ps1 — Flash ESP32 firmware from project root
# Usage:  .\upload.ps1
#         .\upload.ps1 -Port COM3
#         .\upload.ps1 -UploadFS     # also flashes LittleFS (WARNING: erases config.json)

param(
    [string]$Port = "COM5",
    [switch]$UploadFS
)

$pio = "$env:USERPROFILE\.platformio\penv\Scripts\platformio.exe"

if (-not (Test-Path $pio)) {
    Write-Error "PlatformIO not found at $pio. Install it via https://platformio.org"
    exit 1
}

# Release the COM port by killing PlatformIO monitor processes
Write-Host "Releasing $Port (stopping any active serial monitor)..." -ForegroundColor Yellow
Get-Process -Name "python","python3","platformio","pio" -ErrorAction SilentlyContinue |
    ForEach-Object {
        try {
            $cmd = (Get-WmiObject Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
            if ($cmd -match "monitor|$Port") {
                Write-Host "  Killed: $($_.Name) PID=$($_.Id)" -ForegroundColor Yellow
                Stop-Process -Id $_.Id -Force
            }
        } catch {}
    }
Start-Sleep -Milliseconds 800

Write-Host "Uploading firmware to $Port..." -ForegroundColor Cyan
& $pio run --project-dir "$PSScriptRoot\esp32" --target upload --upload-port $Port

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Upload FAILED. Is $Port in use? Try closing any serial monitor windows." -ForegroundColor Red
    exit 1
}

# If -UploadFS is specified, also upload the filesystem (LittleFS).
# WARNING: this erases config.json on the ESP — zones/schedules will be reset.
# Only needed on first flash or after changing esp32/data/ files.
if ($UploadFS) {
    Write-Host ""
    Write-Host "Uploading filesystem (LittleFS) to $Port..." -ForegroundColor Cyan
    Write-Host "WARNING: this erases the live config.json on the ESP." -ForegroundColor Yellow
    & $pio run --project-dir "$PSScriptRoot\esp32" --target uploadfs --upload-port $Port
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Filesystem upload FAILED." -ForegroundColor Red
        exit 1
    }
    Write-Host "Filesystem uploaded." -ForegroundColor Green
}

Write-Host ""
Write-Host "Upload successful! Opening monitor (Ctrl+C to exit)..." -ForegroundColor Green
& $pio device monitor --port $Port --baud 115200 --project-dir "$PSScriptRoot\esp32"
