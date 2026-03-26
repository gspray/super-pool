# upload.ps1 — Flash ESP32 firmware from project root
# Usage:  .\upload.ps1
#         .\upload.ps1 -Port COM3

param(
    [string]$Port = "COM5"
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

Write-Host "Uploading to $Port..." -ForegroundColor Cyan
& $pio run --project-dir "$PSScriptRoot\esp32" --target upload --upload-port $Port

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Upload successful! Opening monitor (Ctrl+C to exit)..." -ForegroundColor Green
    & $pio device monitor --port $Port --baud 115200 --project-dir "$PSScriptRoot\esp32"
} else {
    Write-Host ""
    Write-Host "Upload FAILED. Is $Port in use? Try closing any serial monitor windows." -ForegroundColor Red
}
