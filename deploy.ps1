$ProjectRoot = (Get-Location).Path
$ViteConfig  = Join-Path $ProjectRoot "vite.config.ts"

function Write-Step { param($msg) Write-Host "`n▶  $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "✔  $msg"  -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "⚠  $msg"  -ForegroundColor Yellow }

Write-Step "Patching vite.config.ts..."
$original = Get-Content $ViteConfig -Raw
if ($original -notmatch "manualChunks") {
    $patch = $original -replace '(?s)(export default defineConfig\(\{)', "`$1`n  build: {`n    chunkSizeWarningLimit: 600,`n    rollupOptions: { output: { manualChunks: { 'pdf-libs': ['jspdf','html2canvas'], 'vendor': ['react','react-dom'] } } },`n  },"
    if ($patch -ne $original) { Set-Content $ViteConfig $patch -Encoding UTF8; Write-OK "Patched." }
    else { Write-Warn "Could not auto-patch - add manualChunks manually." }
} else { Write-OK "Already patched - skipping." }

Write-Step "Installing dependencies..."
npm install
Write-OK "Done."

Write-Step "Building web app..."
npm run build
Write-OK "Built."

Write-Step "Building APK..."
$AndroidDir = Join-Path $ProjectRoot "android"
if (Test-Path $AndroidDir) {
    npx cap sync android
    $gw = Join-Path $AndroidDir "gradlew.bat"
    if (Test-Path $gw) {
        Push-Location $AndroidDir
        & $gw assembleDebug --no-daemon
        $apk = Get-ChildItem -Recurse -Filter "*.apk" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($apk) { Write-OK "APK: $($apk.FullName)" } else { Write-Warn "No APK found." }
        Pop-Location
    } else { Write-Warn "gradlew.bat not found." }
} else { Write-Warn "No android/ folder - skipping APK." }

Write-Step "Pushing to GitHub..."
$status = git status --porcelain
if ($status) {
    git add -A
    git commit -m "chore: fix chunk sizes & rebuild [$(Get-Date -Format 'yyyy-MM-dd HH:mm')]"
}
git push
Write-OK "GitHub up to date."

Write-Step "Deploying to Vercel..."
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) { npm install -g vercel }
vercel --prod --yes
Write-OK "Vercel deployed."

Write-Host "`n✔ All done!" -ForegroundColor Green
