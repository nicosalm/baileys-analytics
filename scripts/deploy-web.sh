#!/bin/bash

# Deploy to Cloudflare Pages - Production
# Environment variables are configured in Cloudflare Dashboard

set -e

echo "🚀 Deploying Baileys Dashboard to Cloudflare Pages..."
echo ""

cd apps/web

echo "📦 Building..."
pnpm build

echo "☁️  Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name=baileys-dashboard --branch=main --commit-dirty=true

echo ""
echo "✅ Deployed to https://baileys-dashboard.pages.dev"