#!/bin/bash

# stripe production setup script
# single-tier pricing: $20/month or $192/year

set -e

echo "🔧 baileys analytics - stripe production setup"
echo "=============================================="
echo ""
echo "this script will guide you through setting up stripe for production."
echo "you'll need:"
echo "  1. live stripe api keys"
echo "  2. live stripe webhook secret"
echo "  3. live stripe price ids (2 total: monthly + yearly)"
echo ""
read -p "press enter to continue..."

echo ""
echo "📍 step 1: stripe secret key"
echo "get from: https://dashboard.stripe.com/apikeys (live mode)"
echo "format: sk_live_..."
read -sp "enter STRIPE_SECRET_KEY: " STRIPE_SECRET_KEY
echo ""
echo "$STRIPE_SECRET_KEY" | wrangler secret put STRIPE_SECRET_KEY --env production

echo ""
echo "📍 step 2: stripe publishable key"
echo "get from: https://dashboard.stripe.com/apikeys (live mode)"
echo "format: pk_live_..."
read -p "enter STRIPE_PUBLISHABLE_KEY: " STRIPE_PUBLISHABLE_KEY
echo "$STRIPE_PUBLISHABLE_KEY" | wrangler secret put STRIPE_PUBLISHABLE_KEY --env production

echo ""
echo "📍 step 3: stripe webhook secret"
echo "get from: https://dashboard.stripe.com/webhooks (after creating endpoint)"
echo "format: whsec_..."
read -sp "enter STRIPE_WEBHOOK_SECRET: " STRIPE_WEBHOOK_SECRET
echo ""
echo "$STRIPE_WEBHOOK_SECRET" | wrangler secret put STRIPE_WEBHOOK_SECRET --env production

echo ""
echo "📍 step 4: stripe price ids"
echo "get from: https://dashboard.stripe.com/products (live mode)"
echo "single plan: baileys analytics"
echo ""

echo "monthly price (\$20/mo):"
read -p "enter STRIPE_PRICE_MONTHLY: " STRIPE_PRICE_MONTHLY
echo "$STRIPE_PRICE_MONTHLY" | wrangler secret put STRIPE_PRICE_MONTHLY --env production

echo "yearly price (\$192/yr):"
read -p "enter STRIPE_PRICE_YEARLY: " STRIPE_PRICE_YEARLY
echo "$STRIPE_PRICE_YEARLY" | wrangler secret put STRIPE_PRICE_YEARLY --env production

echo ""
echo "✅ all stripe secrets configured!"
echo ""
echo "📋 next steps:"
echo "  1. update frontend pages environment variables:"
echo "     - VITE_STRIPE_PUBLISHABLE_KEY=$STRIPE_PUBLISHABLE_KEY"
echo "  2. deploy backend: pnpm run deploy:production"
echo "  3. test the webhook in stripe dashboard"
echo ""
echo "✨ setup complete!"
