# Git Branching Strategy

## Branch Structure

### Main Branches
- **`main`** - Production branch. Deploys to production environment
- **`dev`** - Development branch. Integration branch for features, creates preview deployments

### Supporting Branches
- **`feature/*`** - Feature branches created from `dev`
- **`hotfix/*`** - Emergency fixes created from `main`

## Development Workflow

### Local Development
```bash
# Start Workers locally
cd apps/workers
wrangler dev

# In another terminal, start the web app
cd apps/web
pnpm dev
```

### Feature Development
```bash
# Create feature branch from dev
git checkout dev
git pull origin dev
git checkout -b feature/your-feature-name

# Work on feature
git add .
git commit -m "feat: add new feature"

# Push and create PR to dev
git push -u origin feature/your-feature-name
# PR will trigger preview deployment
```

### Releasing to Production
```bash
# Ensure dev is tested and ready
git checkout dev
git pull origin dev

# Create PR from dev to main on GitHub
# After review and merge:

git checkout main
git pull origin main

# Deploy Workers
./scripts/deploy-workers.sh

# Deploy Web App
./scripts/deploy-web.sh
```

### Hotfix Process
```bash
# Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix/urgent-fix

# Make fix and test locally
git commit -m "fix: urgent production issue"

# Push and create PR to main
git push -u origin hotfix/urgent-fix

# After merge to main, deploy and sync
git checkout main
git pull origin main
./scripts/deploy-workers.sh
./scripts/deploy-web.sh

# Merge back to dev
git checkout dev
git merge main
git push origin dev
```

## Branch Protection Rules (GitHub)

### For `main` branch:
- Require pull request reviews (1-2 reviewers)
- Dismiss stale PR approvals on new commits
- Require status checks (tests, build)
- Require branches to be up to date
- Include administrators in restrictions
- No force pushes
- No deletions

### For `dev` branch:
- Require pull request reviews (1 reviewer)
- Require status checks (tests, build)
- No force pushes

## Environment Mapping

| Branch | Environment | Web URL | API URL |
|--------|------------|---------|----------|
| `main` | Production | https://baileys-dashboard.pages.dev | https://baileys-analytics-api-production.nicosalm.workers.dev |
| `dev` | Preview | Preview URL from Cloudflare Pages | Local development (localhost:8787) |
| `feature/*` | Preview | Preview URL from Cloudflare Pages | Local development (localhost:8787) |
| Local | Development | http://localhost:5173 | http://localhost:8787 |

## Deployment Scripts

### Production Only (from main branch)
```bash
# Deploy Workers API
./scripts/deploy-workers.sh

# Deploy Web App
./scripts/deploy-web.sh
```

### Cloudflare Pages Configuration
1. **Production Branch**: `main`
2. **Preview Branches**: All branches get preview deployments
3. **Build Command**: `pnpm build`
4. **Build Output**: `dist`
5. **Environment Variables**: Set in Cloudflare dashboard

## Commit Message Convention

Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting, no code change
- `refactor:` Code restructuring
- `test:` Adding tests
- `chore:` Maintenance

## Quick Reference

```bash
# Local development
cd apps/workers && wrangler dev    # Start Workers
cd apps/web && pnpm dev           # Start Web app

# Create feature branch
git checkout dev
git checkout -b feature/my-feature

# Deploy to production (main branch only)
./scripts/deploy-workers.sh       # Deploy Workers API
./scripts/deploy-web.sh          # Deploy Web app

# Sync dev with main after release
git checkout dev
git merge main
git push origin dev

# Clean up merged branches
git branch -d feature/my-feature
git push origin --delete feature/my-feature
```
