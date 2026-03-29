<#
.SYNOPSIS
    Downloads the self-signed TLS cert from the VM and installs it in the
    Windows Trusted Root CA store so Chrome/Edge trust the HTTPS site.

.USAGE
    .\trust-cert.ps1
    (Run once per Windows machine. Requires admin rights.)
#>

$ErrorActionPreference = 'Stop'

$VM_USER = "gspray"
$VM_HOST = "192.168.86.85"
$VM_SSH  = "${VM_USER}@${VM_HOST}"
$CERT_REMOTE = "/home/${VM_USER}/super-pool/certs/cert.pem"
$CERT_LOCAL  = Join-Path $env:TEMP "super-pool-vm.pem"
$CER_LOCAL   = Join-Path $env:TEMP "super-pool-vm.cer"

Write-Host "Downloading cert from VM..." -ForegroundColor Cyan
$proc = Start-Process -FilePath "ssh" `
    -ArgumentList $VM_SSH, "cat $CERT_REMOTE" `
    -RedirectStandardOutput $CERT_LOCAL `
    -NoNewWindow -Wait -PassThru
if ($proc.ExitCode -ne 0) { Write-Error "SSH failed"; exit 1 }

# Convert PEM -> DER (CER) so Windows can import it
$pem = [System.IO.File]::ReadAllText($CERT_LOCAL)
$b64 = ($pem -replace '-----[^-]+-----', '' -replace '\s', '')
$bytes = [Convert]::FromBase64String($b64)
[System.IO.File]::WriteAllBytes($CER_LOCAL, $bytes)

# Check if already installed
$existing = Get-ChildItem Cert:\LocalMachine\Root |
    Where-Object { $_.Subject -match 'super-pool' }

if ($existing) {
    Write-Host "Cert already trusted: $($existing.Subject)" -ForegroundColor Green
} else {
    Write-Host "Installing cert into Trusted Root CA (requires admin)..." -ForegroundColor Yellow
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store(
        [System.Security.Cryptography.X509Certificates.StoreName]::Root,
        [System.Security.Cryptography.X509Certificates.StoreLocation]::LocalMachine
    )
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($CER_LOCAL)
    $store.Add($cert)
    $store.Close()
    Write-Host "Cert installed: $($cert.Subject)" -ForegroundColor Green
}

Remove-Item $CERT_LOCAL, $CER_LOCAL -Force -ErrorAction SilentlyContinue

Write-Host "`nDone! Restart Chrome, then https://${VM_HOST}:3443 will show a padlock." -ForegroundColor Cyan
Write-Host "The PWA install button should now work." -ForegroundColor Cyan
