#!/bin/bash

# Deploy Cloudflare Workers to Production

echo "🚀 Deploying Baileys Analytics API to Cloudflare Workers..."
echo ""

# Navigate to workers directory
cd apps/workers

# Build the project
echo "📦 Building the project..."
pnpm build

# Deploy to production
echo "☁️  Deploying to Cloudflare Workers..."
wrangler deploy --env production

echo ""
echo "✅ Workers deployed successfully!"
echo ""
echo "Your API is now live at: https://baileys-analytics-api-prod.workers.dev"
echo ""
echo "Next steps:"
echo "1. Set up environment secrets using 'wrangler secret put <SECRET_NAME> --env production'"
echo "2. Deploy the web app to Cloudflare Pages"