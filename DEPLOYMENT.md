# Deployment Guide for Baileys Analytics Waitlist

## Prerequisites
- Azure Account
- Azure CLI installed (`az`)
- Azure Functions Core Tools (`npm install -g azure-functions-core-tools@4`)
- Node.js 18+ installed

## Step 1: Set Up Azure Resources

```bash
# Login to Azure
az login

# Create Resource Group
az group create --name baileys-analytics-rg --location eastus

# Create Storage Account (for Table Storage)
az storage account create \
  --name baileysanalyticsstorage \
  --resource-group baileys-analytics-rg \
  --location eastus \
  --sku Standard_LRS

# Create Function App
az functionapp create \
  --resource-group baileys-analytics-rg \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name baileys-analytics-api \
  --storage-account baileysanalyticsstorage

# Get Storage Connection String
az storage account show-connection-string \
  --name baileysanalyticsstorage \
  --resource-group baileys-analytics-rg \
  --query connectionString \
  --output tsv
```

## Step 2: Configure Azure Function

```bash
# Set environment variables
az functionapp config appsettings set \
  --name baileys-analytics-api \
  --resource-group baileys-analytics-rg \
  --settings \
  AZURE_STORAGE_CONNECTION_STRING="<YOUR_CONNECTION_STRING>" \
  ALLOWED_ORIGIN="https://baileysanalytics.com" \
  SENDGRID_API_KEY="<YOUR_SENDGRID_KEY_IF_USING>"

# Enable CORS
az functionapp cors add \
  --name baileys-analytics-api \
  --resource-group baileys-analytics-rg \
  --allowed-origins https://baileysanalytics.com
```

## Step 3: Deploy Azure Function

```bash
cd apps/functions

# Install dependencies
npm install

# Build TypeScript
npm run build

# Deploy to Azure
func azure functionapp publish baileys-analytics-api
```

## Step 4: Deploy Frontend

### Option A: Deploy to Vercel (Recommended)

```bash
cd apps/web

# Install Vercel CLI
npm i -g vercel

# Set environment variable
echo "VITE_API_URL=https://baileys-analytics-api.azurewebsites.net/api" > .env.production

# Deploy
vercel --prod
```

### Option B: Deploy to Azure Static Web Apps

```bash
# Create Static Web App
az staticwebapp create \
  --name baileys-analytics-web \
  --resource-group baileys-analytics-rg \
  --source https://github.com/YOUR_GITHUB/dashboard-thing \
  --location eastus2 \
  --branch main \
  --app-location "/apps/web" \
  --output-location "dist" \
  --login-with-github
```

### Option C: Deploy to Netlify

```bash
cd apps/web

# Build
npm run build

# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

## Step 5: Configure Custom Domain (Optional)

### For Azure Function:
```bash
az functionapp config hostname add \
  --webapp-name baileys-analytics-api \
  --resource-group baileys-analytics-rg \
  --hostname api.baileysanalytics.com
```

### Update Frontend Environment:
```bash
VITE_API_URL=https://api.baileysanalytics.com/api
```

## Step 6: Test the Deployment

1. Visit your deployed frontend URL
2. Try joining the waitlist
3. Check Azure Portal > Storage Account > Tables > Waitlist for entries

## Step 7: Monitor Waitlist Entries

### Via Azure Portal:
1. Go to Storage Account
2. Navigate to Tables
3. Open "Waitlist" table

### Via Azure Storage Explorer:
1. Download Azure Storage Explorer
2. Connect with connection string
3. Browse Tables > Waitlist

### Export to CSV (Azure CLI):
```bash
az storage entity query \
  --table-name Waitlist \
  --connection-string "<YOUR_CONNECTION_STRING>" \
  --output table
```

## Local Development

```bash
# Terminal 1: Start Azure Functions locally
cd apps/functions
npm install
npm run build
npm run start

# Terminal 2: Start Frontend
cd apps/web
npm install
npm run dev
```

## Troubleshooting

### CORS Issues
- Ensure ALLOWED_ORIGIN in Azure Function matches your frontend URL
- Add trailing slash issues: Try both with and without

### Function Not Working
- Check Function App logs in Azure Portal
- Ensure Table Storage connection string is correct
- Verify Node.js version is 18+

### Email Not Sending
- Verify SendGrid API key is set
- Check SendGrid sender verification
- Review Function logs for email errors

## Security Checklist
- [ ] Remove local.settings.json from git
- [ ] Use Azure Key Vault for sensitive values
- [ ] Enable HTTPS only on Function App
- [ ] Restrict CORS to production domain only
- [ ] Enable Application Insights for monitoring
- [ ] Set up rate limiting on Function App

## Cost Estimate
- Storage Account: ~$1/month
- Function App (Consumption): ~$0 for low traffic
- SendGrid: Free tier up to 100 emails/day
- **Total: < $5/month for waitlist**