@echo off
echo Adding Stripe environment variables to Railway...
echo.
echo Please provide your Stripe keys from https://dashboard.stripe.com/apikeys
echo.
set /p STRIPE_PUBLISHABLE_KEY="Enter your STRIPE_PUBLISHABLE_KEY (pk_live_... or pk_test_...): "
set /p STRIPE_SECRET_KEY="Enter your STRIPE_SECRET_KEY (sk_live_... or sk_test_...): "

echo.
echo Setting Railway variables...
railway variables set STRIPE_PUBLISHABLE_KEY="%STRIPE_PUBLISHABLE_KEY%"
railway variables set STRIPE_SECRET_KEY="%STRIPE_SECRET_KEY%"

echo.
echo Variables added! Your Railway app will redeploy automatically.
echo You can check the deployment at: railway open
pause