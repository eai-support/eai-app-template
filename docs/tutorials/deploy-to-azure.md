---
sidebar_position: 3
slug: /tutorials/deploy-to-azure
---

# Tutorial: Deploy to Azure

Deploy your app to an Azure App Service owned by your project or organization. Your app will be available at `https://<your-app-service>.azurewebsites.net/<your-app-name>`.

## Prerequisites

- A working app project
- GitHub repository created
- Azure subscription with access to an App Service
- GitHub Secrets configured (or admin access to set them)
- A tenant that is already connected and verified through the `eai` CLI

Before you deploy, confirm the platform side is healthy:

```bash
eai login
eai tenant select <tenant-slug>
eai types validate
eai types seed --tenant-key <tenant-key> --tenant-id <tenant-id> --format json
eai types diff --tenant-key <tenant-key> --tenant-id <tenant-id>
eai resources schema --tenant-id <tenant-id> --format json
eai verify calls --tenant-id <tenant-id> --resource-type <resource-type>
```

For tenant data, the platform remains the storage boundary. Your frontend should never receive raw database, blob storage, or search service credentials.

## Step 1: Register Your App in Infrastructure

Add your app to your deployment infrastructure configuration. For example:

```bicep
param appNames = [
  'existing-app'
  'my-vertical'    // ← Add your app here
]
```

This provisions:
- Port assignment (auto-incremented: 3001, 3002, ...)
- Router entry for subpath routing
- Startup script configuration

## Step 2: Configure Deployment with eai CLI

The fastest way to set up deployment:

```bash
eai deploy setup --repo eai-tools/my-vertical
```

This command:
1. Generates `.github/workflows/deploy-demo.yml` if it doesn't exist
2. Sets `APP_NAME` in the workflow to your app's name
3. Configures GitHub Secrets for Azure authentication

### Manual Configuration

If you prefer to configure manually, edit `.github/workflows/deploy-demo.yml`:

```yaml
env:
  APP_NAME: my-vertical   # Must match your infrastructure registration
```

Configure these GitHub Secrets in `Settings > Environments > demo`:

| Secret | Description |
|--------|-------------|
| `AZUREAPPSERVICE_CLIENTID` | Azure AD app registration client ID |
| `AZUREAPPSERVICE_TENANTID` | Azure AD tenant ID |
| `AZUREAPPSERVICE_SUBSCRIPTIONID` | Azure subscription ID |
| `AZURE_RESOURCE_GROUP` | `rg-example-apps` |
| `AZURE_WEBAPP_NAME` | `example-app-service` |

## Step 3: Set Environment Variables

Your app needs runtime environment variables in Azure App Service. These are set through the Azure Portal or CLI:

```bash
# Required variables
az webapp config appsettings set \
  --resource-group <resource-group> \
  --name <app-service-name> \
  --settings \
  BASE_URL_PUBLIC_API=https://api.test.example.com \
  TENANT_tracker_ID=<your-tenant-id> \
  WORKFLOW_tracker_ID=<your-workflow-id> \
  ENTRA_TENANT_NAME=example-ciam-tenant \
  ENTRA_TENANT_ID=<entra-tenant-id> \
  ENTRA_CLIENT_ID=<client-id> \
  ENTRA_CLIENT_SECRET=<client-secret> \
  AUTH_SECRET=$(openssl rand -base64 32) \
  APP_BASE_PATH=/my-vertical
```

## Step 4: Deploy

Push to `main` to trigger automatic deployment:

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

Or trigger manually:

```bash
eai deploy trigger
```

## Step 5: Verify

Check deployment status:

```bash
eai deploy status
```

Then visit your app:

```
https://<your-app-service>.azurewebsites.net/my-vertical
```

Run platform checks:

```bash
eai verify
```

## How Multi-App Deployment Works

```
Azure App Service (<your-app-service>)
├── Express Router (port 8080)
│   ├── /app-one    → localhost:3001
│   ├── /app-two    → localhost:3002
│   └── /my-vertical → localhost:3003
├── app-one/       (standalone Next.js)
├── app-two/       (standalone Next.js)
└── my-vertical/   (standalone Next.js)
```

Each app runs as a standalone Next.js server on its own port. The router handles:
- Subpath routing (`/my-vertical/*` → `localhost:3003`)
- Port assignment (from your app registration order)
- Process management (PM2-like startup)

### Build Process

The GitHub Actions workflow:
1. Checks out your code
2. Installs dependencies (`npm ci`)
3. Builds with subpath: `APP_BASE_PATH=/my-vertical npm run build`
4. Packages the standalone output
5. Deploys via `az webapp deploy --type zip`
6. Restarts the App Service

### The `basePath` Configuration

`next.config.ts` reads `APP_BASE_PATH` to configure Next.js subpath routing:

```typescript
const nextConfig = {
  basePath: process.env.APP_BASE_PATH || '',
  assetPrefix: process.env.APP_BASE_PATH || '',
  output: 'standalone',
};
```

This ensures all routes and static assets are served under `/my-vertical/`.

## Troubleshooting

### App returns 404

- Check that `APP_NAME` in the workflow matches your infrastructure registration
- Verify `APP_BASE_PATH` is set correctly in Azure App Settings
- Check the Express router is restarted: `az webapp restart ...`

### Authentication redirect fails

- Ensure `AUTH_URL` includes the **full path through `/api/auth`**:
  `https://<your-app-service>.azurewebsites.net/my-vertical/api/auth`
  (Auth.js v5 reads the URL's pathname as its basePath; without `/api/auth`
  in `AUTH_URL`, the action parser rejects every request as `UnknownAction`.)
- Verify Entra CIAM redirect URIs include `{AUTH_URL}/callback/microsoft-entra-id`
- The `[...nextauth]` route handler ships with a small request rewriter that
  re-prepends `APP_BASE_PATH` to the URL Next.js stripped before invoking
  Auth.js — see `src/app/api/auth/[...nextauth]/route.ts`. Don't simplify
  it to `export const { GET, POST } = handlers` or sign-in will 400 with
  `UnknownAction: Cannot parse action at /api/auth/...`. Upstream issue:
  [nextauthjs/next-auth#9722](https://github.com/nextauthjs/next-auth/issues/9722).

### Build fails

Run locally first:

```bash
APP_BASE_PATH=/my-vertical npm run build
```

### Environment variables not loading

```bash
az webapp config appsettings list \
  --resource-group <resource-group> \
  --name <app-service-name> \
  --query "[?contains(name, 'TENANT')]"
```

## What You Learned

- **Multi-app architecture**: How multiple apps can share one App Service
- **Subpath routing**: `APP_BASE_PATH` and Express router configuration
- **CI/CD pipeline**: GitHub Actions → Azure deployment flow
- **Infrastructure registration**: Adding your app to deployment infrastructure

## Next Steps

- [Architecture Overview](/docs/architecture/overview) — Full platform architecture
- [Environment Configuration](/docs/configuration/environment) — All environment variables explained
- [Troubleshooting Guide](/docs/getting-started/troubleshooting) — Common issues and fixes
