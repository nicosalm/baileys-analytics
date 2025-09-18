#!/bin/bash

# Deploy Cloudflare Workers to Production

echo "🚀 Deploying Baileys Analytics API to Cloudflare Workers (Production)..."
echo ""

# Ensure we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "❌ Error: You must be on the main branch to deploy to production"
    echo "Current branch: $CURRENT_BRANCH"
    echo ""
    echo "To deploy to production:"
    echo "1. git checkout main"
    echo "2. git pull origin main"
    echo "3. ./scripts/deploy-workers.sh"
    exit 1
fi

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
echo "Your API is now live at: https://baileys-analytics-api-production.nicosalm.workers.dev"
echo ""
echo "Next steps:"
echo "1. Set up environment secrets using 'wrangler secret put <SECRET_NAME> --env production'"
echo "2. Deploy the web app using ./scripts/deploy-prod.sh"