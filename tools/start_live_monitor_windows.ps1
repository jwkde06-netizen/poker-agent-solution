$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Host "Dream Poker live monitor - Windows starter" -ForegroundColor Cyan
if (-not (Get-Command py -ErrorAction SilentlyContinue) -and -not (Get-Command python -ErrorAction SilentlyContinue)) {
 Write-Host "Python 3.10+ is required. Install it from python.org and run again." -ForegroundColor Red
 exit 1
}
$python = if (Get-Command py -ErrorAction SilentlyContinue) { "py" } else { "python" }
$check = Test-NetConnection -ComputerName 192.168.1.9 -Port 5855 -WarningAction SilentlyContinue
if (-not $check.TcpTestSucceeded) {
 Write-Host "Cannot reach 192.168.1.9:5855. Connect to the same store LAN/Wi-Fi." -ForegroundColor Red
 exit 1
}
Write-Host "Installing collector dependencies (first run may take a few minutes)..."
& $python -m pip install playwright supabase
if ($LASTEXITCODE -ne 0) { throw "Dependency install failed" }
& $python -m playwright install chromium
if ($LASTEXITCODE -ne 0) { throw "Chromium installation failed" }
$url = Read-Host "Supabase project URL (https://...supabase.co)"
if ($url -notmatch '^https://[a-z0-9-]+\.supabase\.co/?$') { throw "Invalid Supabase URL" }
$secret = Read-Host "Supabase service-role key (hidden; not saved to disk)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
 $env:SUPABASE_URL = $url.TrimEnd("/")
 $env:SUPABASE_SERVICE_ROLE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
 Write-Host "Collector running. Keep this window open; Ctrl+C to stop." -ForegroundColor Green
 & $python (Join-Path $PSScriptRoot "live_monitor_bridge.py")
} finally {
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
 Remove-Item Env:\SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
 Remove-Item Env:\SUPABASE_URL -ErrorAction SilentlyContinue
}
