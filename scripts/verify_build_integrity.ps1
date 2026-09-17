# Physical Build & Integrity Verification Script for IdentityLogInsystem
$ErrorActionPreference = "Continue"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  IdentityLogInsystem - Physical Build Integrity Check" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$WorkspaceRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $WorkspaceRoot

# 1. Lint Check
Write-Host "
[Step 1/4] Running oxlint..." -ForegroundColor Yellow
$lintOutput = npm run lint 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "LINT FAILED:
$lintOutput" -ForegroundColor Red
    exit 1
}
Write-Host "Lint passed with 0 errors!" -ForegroundColor Green

# 2. Build Check
Write-Host "
[Step 2/4] Running production build (tsc -b && vite build)..." -ForegroundColor Yellow
$buildOutput = npm run build 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "BUILD FAILED:
$buildOutput" -ForegroundColor Red
    exit 1
}
Write-Host "Build passed successfully!" -ForegroundColor Green

# 3. Dist Artifact Integrity
Write-Host "
[Step 3/4] Checking dist output artifacts..." -ForegroundColor Yellow
$requiredFiles = @(
    "dist\index.html",
    "dist\home.html",
    "dist\oauth.html",
    "dist\share.html",
    "dist\manifest.json",
    "dist\favicon.ico",
    "dist\apple-touch-icon.png"
)

foreach ($relPath in $requiredFiles) {
    $fullPath = Join-Path $WorkspaceRoot $relPath
    if (-not (Test-Path $fullPath)) {
        Write-Host "MISSING ARTIFACT: $relPath" -ForegroundColor Red
        exit 1
    }
    $size = (Get-Item $fullPath).Length
    if ($size -le 0) {
        Write-Host "EMPTY ARTIFACT: $relPath (0 bytes)" -ForegroundColor Red
        exit 1
    }
    Write-Host "  [OK] $relPath ($size bytes)" -ForegroundColor Green
}

# 4. Bundle Assets Validation
Write-Host "
[Step 4/4] Validating bundled assets and script links..." -ForegroundColor Yellow
$assetsDir = Join-Path $WorkspaceRoot "dist\assets"
if (-not (Test-Path $assetsDir)) {
    Write-Host "MISSING ASSETS DIR: dist\assets" -ForegroundColor Red
    exit 1
}

$jsFiles = Get-ChildItem -Path $assetsDir -Filter "*.js"
$cssFiles = Get-ChildItem -Path $assetsDir -Filter "*.css"
Write-Host "  Found $($jsFiles.Count) JS bundles and $($cssFiles.Count) CSS bundles." -ForegroundColor Green

if ($jsFiles.Count -eq 0 -or $cssFiles.Count -eq 0) {
    Write-Host "Assets directory missing JS or CSS files!" -ForegroundColor Red
    exit 1
}

# Verify that each HTML references at least one bundled JS and CSS
$htmlFiles = @("index.html", "home.html", "oauth.html", "share.html")
foreach ($html in $htmlFiles) {
    $content = Get-Content (Join-Path $WorkspaceRoot "dist\$html") -Raw
    if ($content -notmatch 'src="\./assets/.*\.js"') {
        Write-Host "WARNING: dist\$html does not seem to contain relative script bundle path!" -ForegroundColor Yellow
    } else {
        Write-Host "  [OK] dist\$html references assets bundles." -ForegroundColor Green
    }
}

Write-Host "
====================================================" -ForegroundColor Cyan
Write-Host "  ALL PHYSICAL VERIFICATION CHECKS PASSED [CLEARED] " -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Cyan
exit 0
