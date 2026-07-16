param(
    [Parameter(Mandatory = $true)]
    [string]$Email,

    [string]$BaseUrl = "http://localhost:3000",

    [string]$Secret
)

# Manual test for the /api/watch-sync webhook: sends a bad token (expects 401),
# then a real payload (expects 200). Reads the token from .env by default so the
# script and the server cannot drift apart.
#
# Local:
#   powershell -ExecutionPolicy Bypass -File scripts\test-watch-sync.ps1 -Email you@example.com
#
# Deployed (secret is only in the Vercel env, not in the local .env):
#   powershell -ExecutionPolicy Bypass -File scripts\test-watch-sync.ps1 `
#       -Email you@example.com -BaseUrl https://your-app.vercel.app -Secret "<secret>"

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"
$url = "$BaseUrl/api/watch-sync"

function Get-StatusAndBody($scriptBlock) {
    try {
        $r = & $scriptBlock
        return @{ Status = [int]$r.StatusCode; Body = $r.Content }
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if ($null -eq $resp) { return @{ Status = 0; Body = $_.Exception.Message } }
        $status = [int]$resp.StatusCode
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $body = $reader.ReadToEnd()
        $reader.Close()
        return @{ Status = $status; Body = $body }
    }
}

# --- resolve secret: -Secret wins, otherwise read .env ---------------------
if (-not [string]::IsNullOrWhiteSpace($Secret)) {
    $secret = $Secret
    Write-Host "Sekret z parametru -Secret (dlugosc: $($secret.Length) znakow)" -ForegroundColor DarkGray
} else {
    if (-not (Test-Path $envFile)) {
        Write-Host "BLAD: brak pliku .env w $root (uzyj -Secret dla zdalnego srodowiska)" -ForegroundColor Red
        exit 1
    }

    $secret = $null
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*WATCH_SYNC_SECRET\s*=\s*(.+?)\s*$') {
            $secret = $Matches[1].Trim('"').Trim("'")
        }
    }

    if ([string]::IsNullOrWhiteSpace($secret)) {
        Write-Host "BLAD: WATCH_SYNC_SECRET nie znaleziony w .env" -ForegroundColor Red
        exit 1
    }
    Write-Host "Sekret wczytany z .env (dlugosc: $($secret.Length) znakow)" -ForegroundColor DarkGray
}
Write-Host "Cel: $url"
Write-Host ""

# --- test 1: bad token -> expect 401 ---------------------------------------
Write-Host "[1/2] Zly token (oczekiwane 401)..." -NoNewline
$r1 = Get-StatusAndBody {
    Invoke-WebRequest -Uri $url -Method Post -Headers @{ Authorization = "Bearer zly-token" } `
        -ContentType "application/json" -Body "{}" -UseBasicParsing
}
if ($r1.Status -eq 401) {
    Write-Host " OK (401)" -ForegroundColor Green
} elseif ($r1.Status -eq 500) {
    Write-Host " BLAD (500)" -ForegroundColor Red
    Write-Host "  -> Serwer nie widzi WATCH_SYNC_SECRET. Zrestartuj: Ctrl+C, potem npm start" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host " NIEOCZEKIWANE ($($r1.Status))" -ForegroundColor Red
    Write-Host "  $($r1.Body)"
    exit 1
}

# --- test 2: good token -> expect 200 --------------------------------------
$today = (Get-Date).ToString("yyyy-MM-dd")
$body = @{
    date            = $today
    active_calories = 620
    resting_hr      = 54
    sleep_hours     = 7.5
    user_email      = $Email
} | ConvertTo-Json -Compress

Write-Host "[2/2] Dobry token, data $today, email $Email (oczekiwane 200)..." -NoNewline
$r2 = Get-StatusAndBody {
    Invoke-WebRequest -Uri $url -Method Post -Headers @{ Authorization = "Bearer $secret" } `
        -ContentType "application/json" -Body $body -UseBasicParsing
}
if ($r2.Status -eq 200) {
    Write-Host " OK (200)" -ForegroundColor Green
    Write-Host "  $($r2.Body)"
    Write-Host ""
    Write-Host "Gotowe. Wejdz na $BaseUrl/ai-coach - w biezacym tygodniu ma byc blok 'Zdrowie'." -ForegroundColor Green
} else {
    Write-Host " BLAD ($($r2.Status))" -ForegroundColor Red
    Write-Host "  $($r2.Body)"
    switch ($r2.Status) {
        404 { Write-Host "  -> Nie ma uzytkownika o emailu '$Email'. Uruchom z: -Email twoj@email" -ForegroundColor Yellow }
        401 { Write-Host "  -> Token z .env odrzucony. Serwer moze miec stara wartosc - zrestartuj npm start" -ForegroundColor Yellow }
        400 { Write-Host "  -> Serwer odrzucil body." -ForegroundColor Yellow }
    }
    exit 1
}
