#!/bin/bash

# stripe production setup script
# tiered pricing: starter / growth / portfolio, plus legacy single-tier

set -e

echo "baileys analytics - stripe production setup"
echo "=============================================="
echo ""
echo "this script will guide you through setting up stripe for production."
echo "you'll need:"
echo "  1. live stripe api keys"
echo "  2. live stripe webhook secret"
echo "  3. live stripe price ids (8 total: 2 legacy + 6 tiered)"
echo ""
read -p "press enter to continue..."

echo ""
echo "step 1: stripe secret key"
echo "get from: https://dashboard.stripe.com/apikeys (live mode)"
echo "format: sk_live_..."
read -sp "enter STRIPE_SECRET_KEY: " STRIPE_SECRET_KEY
echo ""
echo "$STRIPE_SECRET_KEY" | wrangler secret put STRIPE_SECRET_KEY --env production

echo ""
echo "step 2: stripe publishable key"
echo "get from: https://dashboard.stripe.com/apikeys (live mode)"
echo "format: pk_live_..."
read -p "enter STRIPE_PUBLISHABLE_KEY: " STRIPE_PUBLISHABLE_KEY
echo "$STRIPE_PUBLISHABLE_KEY" | wrangler secret put STRIPE_PUBLISHABLE_KEY --env production

echo ""
echo "step 3: stripe webhook secret"
echo "get from: https://dashboard.stripe.com/webhooks (after creating endpoint)"
echo "format: whsec_..."
read -sp "enter STRIPE_WEBHOOK_SECRET: " STRIPE_WEBHOOK_SECRET
echo ""
echo "$STRIPE_WEBHOOK_SECRET" | wrangler secret put STRIPE_WEBHOOK_SECRET --env production

echo ""
echo "step 4: stripe price ids"
echo "get from: https://dashboard.stripe.com/products (live mode)"
echo ""

echo "--- legacy single-tier prices (grandfathered subscribers only) ---"

echo "legacy monthly price:"
read -p "enter STRIPE_PRICE_MONTHLY: " STRIPE_PRICE_MONTHLY
echo "$STRIPE_PRICE_MONTHLY" | wrangler secret put STRIPE_PRICE_MONTHLY --env production

echo "legacy yearly price:"
read -p "enter STRIPE_PRICE_YEARLY: " STRIPE_PRICE_YEARLY
echo "$STRIPE_PRICE_YEARLY" | wrangler secret put STRIPE_PRICE_YEARLY --env production

echo ""
echo "--- tiered prices (new subscribers) ---"

echo "starter monthly (\$20/mo):"
read -p "enter STRIPE_PRICE_STARTER_MONTHLY: " STRIPE_PRICE_STARTER_MONTHLY
echo "$STRIPE_PRICE_STARTER_MONTHLY" | wrangler secret put STRIPE_PRICE_STARTER_MONTHLY --env production

echo "starter yearly (\$199/yr):"
read -p "enter STRIPE_PRICE_STARTER_YEARLY: " STRIPE_PRICE_STARTER_YEARLY
echo "$STRIPE_PRICE_STARTER_YEARLY" | wrangler secret put STRIPE_PRICE_STARTER_YEARLY --env production

echo "growth monthly (\$39/mo):"
read -p "enter STRIPE_PRICE_GROWTH_MONTHLY: " STRIPE_PRICE_GROWTH_MONTHLY
echo "$STRIPE_PRICE_GROWTH_MONTHLY" | wrangler secret put STRIPE_PRICE_GROWTH_MONTHLY --env production

echo "growth yearly (\$399/yr):"
read -p "enter STRIPE_PRICE_GROWTH_YEARLY: " STRIPE_PRICE_GROWTH_YEARLY
echo "$STRIPE_PRICE_GROWTH_YEARLY" | wrangler secret put STRIPE_PRICE_GROWTH_YEARLY --env production

echo "portfolio monthly (\$79/mo):"
read -p "enter STRIPE_PRICE_PORTFOLIO_MONTHLY: " STRIPE_PRICE_PORTFOLIO_MONTHLY
echo "$STRIPE_PRICE_PORTFOLIO_MONTHLY" | wrangler secret put STRIPE_PRICE_PORTFOLIO_MONTHLY --env production

echo "portfolio yearly (\$799/yr):"
read -p "enter STRIPE_PRICE_PORTFOLIO_YEARLY: " STRIPE_PRICE_PORTFOLIO_YEARLY
echo "$STRIPE_PRICE_PORTFOLIO_YEARLY" | wrangler secret put STRIPE_PRICE_PORTFOLIO_YEARLY --env production

echo ""
echo "all stripe secrets configured!"
echo ""
echo "next steps:"
echo "  1. update frontend pages environment variables:"
echo "     - VITE_STRIPE_PUBLISHABLE_KEY=$STRIPE_PUBLISHABLE_KEY"
echo "  2. deploy backend: pnpm run deploy:production"
echo "  3. test the webhook in stripe dashboard"
echo ""
echo "setup complete!"
