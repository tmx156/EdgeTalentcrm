Write-Host "Adding Stripe environment variables to Railway..." -ForegroundColor Green
Write-Host ""

# Check if Railway CLI is authenticated
try {
    $whoami = & railway whoami 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Please login to Railway first:" -ForegroundColor Yellow
        Write-Host "railway login" -ForegroundColor Cyan
        Read-Host "Press Enter after you've logged in"
    }
} catch {
    Write-Host "Railway CLI not found or not authenticated. Please run 'railway login' first." -ForegroundColor Red
    exit 1
}

Write-Host "Please provide your Stripe keys from https://dashboard.stripe.com/apikeys" -ForegroundColor Yellow
Write-Host ""

$STRIPE_PUBLISHABLE_KEY = Read-Host "Enter your STRIPE_PUBLISHABLE_KEY (pk_live_... or pk_test_...)"

$STRIPE_SECRET_KEY = Read-Host "Enter your STRIPE_SECRET_KEY (sk_live_... or sk_test_...)"

Write-Host ""
Write-Host "Setting Railway variables..." -ForegroundColor Green

try {
    & railway variables set STRIPE_PUBLISHABLE_KEY "$STRIPE_PUBLISHABLE_KEY"
    & railway variables set STRIPE_SECRET_KEY "$STRIPE_SECRET_KEY"

    Write-Host ""
    Write-Host "✅ Stripe variables added successfully!" -ForegroundColor Green
    Write-Host "Your Railway app will redeploy automatically." -ForegroundColor Green
    Write-Host "You can check the deployment with: railway open" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "❌ Error adding variables. Please check your Railway authentication." -ForegroundColor Red
    Write-Host "Make sure you're logged in with: railway login" -ForegroundColor Yellow
}

Read-Host "Press Enter to exit"