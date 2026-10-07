# Physical Build & Integrity Verification Script for IdentityLogInsystem
$ErrorActionPreference = "Continue"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  IdentityLogInsystem - Physical Build Integrity Check" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $WorkspaceRoot

# 1. Lint Check
Write-Host "`n[Step 1/5] Running oxlint..." -ForegroundColor Yellow
$lintOutput = npm run lint 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "LINT FAILED:`n$lintOutput" -ForegroundColor Red
    exit 1
}
Write-Host "Lint passed with 0 errors!" -ForegroundColor Green

# 2. Automated Test Suite (RBAC / BOLA / Adversarial Verification)
Write-Host "`n[Step 2/5] Running automated adversarial test suite..." -ForegroundColor Yellow
$testOutput = npm test 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "AUTOMATED TESTS FAILED:`n$testOutput" -ForegroundColor Red
    exit 1
}
Write-Host "All automated adversarial tests passed with 0 defects!" -ForegroundColor Green

# 3. Build Check
Write-Host "`n[Step 3/5] Running production build (tsc -b && vite build)..." -ForegroundColor Yellow
$buildOutput = npm run build 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "BUILD FAILED:`n$buildOutput" -ForegroundColor Red
    exit 1
}
Write-Host "Build passed successfully!" -ForegroundColor Green

# 4. Dist Artifact Integrity
Write-Host "`n[Step 4/5] Checking dist output artifacts..." -ForegroundColor Yellow
$requiredFiles = @(
    "index.html",
    "home.html",
    "oauth.html",
    "share.html",
    "manifest.json",
    "favicon.ico",
    "apple-touch-icon.png"
)

$distDir = Join-Path $WorkspaceRoot "dist"
foreach ($fileName in $requiredFiles) {
    $fullPath = Join-Path $distDir $fileName
    if (-not (Test-Path $fullPath)) {
        Write-Host "MISSING ARTIFACT: dist/$fileName" -ForegroundColor Red
        exit 1
    }
    $size = (Get-Item $fullPath).Length
    if ($size -le 0) {
        Write-Host "EMPTY ARTIFACT: dist/$fileName (0 bytes)" -ForegroundColor Red
        exit 1
    }
    Write-Host "  [OK] dist/$fileName ($size bytes)" -ForegroundColor Green
}

# 5. Bundle Assets Validation
Write-Host "`n[Step 5/5] Validating bundled assets, JS links, and CSS links..." -ForegroundColor Yellow
$assetsDir = Join-Path $distDir "assets"
if (-not (Test-Path $assetsDir)) {
    Write-Host "MISSING ASSETS DIR: dist/assets" -ForegroundColor Red
    exit 1
}

$jsFiles = Get-ChildItem -Path $assetsDir -Filter "*.js"
$cssFiles = Get-ChildItem -Path $assetsDir -Filter "*.css"
Write-Host "  Found $($jsFiles.Count) JS bundles and $($cssFiles.Count) CSS bundles." -ForegroundColor Green

if ($jsFiles.Count -eq 0 -or $cssFiles.Count -eq 0) {
    Write-Host "Assets directory missing JS or CSS files!" -ForegroundColor Red
    exit 1
}

# Verify that each HTML references bundled JS and CSS
$htmlFiles = @("index.html", "home.html", "oauth.html", "share.html")
foreach ($html in $htmlFiles) {
    $fullHtmlPath = Join-Path $distDir $html
    $content = Get-Content $fullHtmlPath -Raw

    # JS bundle link verification (supports relative, absolute, base path subdirs, and cache busting queries)
    if ($content -notmatch 'src="[^"]*assets/[^"]+\.js(?:\?[^"]*)?"') {
        Write-Host "MISSING JS LINK: dist/$html does not reference assets JS bundle!" -ForegroundColor Red
        exit 1
    }

    # CSS bundle link verification (supports relative, absolute, base path subdirs, and cache busting queries)
    if ($content -notmatch 'href="[^"]*assets/[^"]+\.css(?:\?[^"]*)?"') {
        Write-Host "MISSING CSS LINK: dist/$html does not reference assets CSS bundle!" -ForegroundColor Red
        exit 1
    }

    Write-Host "  [OK] dist/$html references valid JS and CSS bundles." -ForegroundColor Green
}

Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host "  ALL PHYSICAL VERIFICATION CHECKS PASSED [CLEARED] " -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Cyan
exit 0
