# RavenLens Deployment Guide

This guide covers deploying RavenLens to AWS using App Runner (backend), Vercel (frontend), and RDS PostgreSQL (database).

## Architecture Overview

```
┌─────────────┐                 ┌────────────────────────┐
│   Browser   │ ◄─────────────► │    Vercel (Frontend)   │
└─────────────┘                 │    React SPA           │
       │                        └────────────────────────┘
       │ API
       ▼
┌─────────────────┐         ┌─────────────────┐
│   App Runner    │────────►│   RDS Postgres  │
│   (Backend)     │         │   (Database)    │
└────────┬────────┘         └─────────────────┘
         │
         ▼
┌─────────────────┐
│  AWS Bedrock    │
│  (Claude 3.5)   │
└─────────────────┘
```

## Prerequisites

- AWS CLI installed and configured
- GitHub repository with Actions enabled
- AWS account with appropriate permissions
- Vercel account (free tier works)

---

## Step 1: Run Bootstrap Script

The bootstrap script creates all required AWS resources.

```bash
cd infra
chmod +x bootstrap.sh
./bootstrap.sh
```

This creates:
- **ECR Repository**: `ravenlens-backend` (for Docker images)
- **RDS Instance**: `ravenlens-db` (PostgreSQL 15, db.t3.micro)
- **IAM Role**: `ravenlens-apprunner-task-role` (with Bedrock permissions)

**IMPORTANT**: Save the RDS password printed by the script!

---

## Step 2: Add GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret

### Backend Secrets (AWS)

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `AWS_ACCESS_KEY_ID` | IAM user access key for CI/CD | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key | `wJalr...` |
| `VITE_API_BASE_URL` | Backend API URL (after Step 4) | `https://abc123.us-west-2.awsapprunner.com` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://ravenlens_user:PASSWORD@endpoint:5432/ravenlens` |

### Frontend Secrets (Vercel)

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `VERCEL_TOKEN` | Vercel API token | Vercel dashboard → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel organization/team ID | Run `npx vercel link` in frontend/ |
| `VERCEL_PROJECT_ID` | Vercel project ID | Run `npx vercel link` in frontend/ |

### Creating the CI/CD IAM User

1. Go to AWS IAM → Users → Create user
2. Name: `ravenlens-github-actions`
3. Attach the policy from `infra/iam-policy.json`
4. Create access key for "Application running outside AWS"
5. Save the access key ID and secret access key as GitHub secrets

---

## Step 3: Enable pgvector Extension

Wait for RDS to be available:

```bash
aws rds wait db-instance-available \
    --db-instance-identifier ravenlens-db \
    --region us-west-2
```

Get the RDS endpoint:

```bash
aws rds describe-db-instances \
    --db-instance-identifier ravenlens-db \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text
```

Connect to the database and enable pgvector:

```bash
psql postgresql://ravenlens_user:PASSWORD@ENDPOINT:5432/ravenlens
```

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Then run migrations:

```bash
cd backend
alembic upgrade head
```

---

## Step 4: Set Up Vercel for Frontend

1. **Import project on Vercel**:
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Set the root directory to `frontend`
   - Framework preset will auto-detect Vite

2. **Configure environment variables in Vercel**:
   - Go to Project Settings → Environment Variables
   - Add `VITE_API_BASE_URL` with your App Runner URL (after Step 5)

3. **Get Vercel credentials for GitHub Actions**:
   ```bash
   cd frontend
   npx vercel link
   ```
   - This creates `.vercel/project.json` with `orgId` and `projectId`
   - Add these as `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` GitHub secrets

4. **Get Vercel token**:
   - Go to Vercel dashboard → Settings → Tokens
   - Create a new token and add as `VERCEL_TOKEN` GitHub secret

---

## Step 5: Create App Runner Service (First Deploy)

1. Go to AWS Console → App Runner → Create service

2. **Source**:
   - Repository type: Container registry
   - Provider: Amazon ECR
   - Select repository: `ravenlens-backend`
   - Image tag: `latest`
   - ECR access role: Create new role (or use existing)

3. **Deployment settings**:
   - Deployment trigger: Automatic
   - ECR access role: Use the one created above

4. **Configure service**:
   - Service name: `ravenlens-backend`
   - CPU: 1 vCPU
   - Memory: 2 GB
   - Port: `8000`

5. **Health check**:
   - Protocol: HTTP
   - Path: `/health`
   - Interval: 10 seconds
   - Timeout: 5 seconds
   - Healthy threshold: 1
   - Unhealthy threshold: 5

6. **Instance role**: Select `ravenlens-apprunner-task-role`

7. **Environment variables**:
   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | `postgresql://ravenlens_user:PASSWORD@RDS_ENDPOINT:5432/ravenlens` |
   | `AWS_DEFAULT_REGION` | `us-west-2` |
   | `RECALL_API_KEY` | Your Recall.ai API key |
   | `ENVIRONMENT` | `production` |

8. Create service and wait for it to deploy

9. Copy the service URL (e.g., `https://abc123.us-west-2.awsapprunner.com`) to:
   - GitHub Secrets as `VITE_API_BASE_URL`
   - Vercel project environment variables as `VITE_API_BASE_URL`

---

## Step 6: Migrate SQLite Data (Optional)

If you have existing data in SQLite:

```bash
cd infra
pip install psycopg2-binary

# Preview what will be migrated
python migrate_sqlite_to_postgres.py \
    --sqlite ../backend/ravenlens.db \
    --postgres "postgresql://ravenlens_user:PASSWORD@ENDPOINT:5432/ravenlens" \
    --dry-run

# Run the actual migration
python migrate_sqlite_to_postgres.py \
    --sqlite ../backend/ravenlens.db \
    --postgres "postgresql://ravenlens_user:PASSWORD@ENDPOINT:5432/ravenlens"
```

---

## Deployment Workflows

After setup, deployments happen automatically:

### Backend (App Runner)
- **Trigger**: Push to `main` affecting `backend/**` or `Dockerfile`
- **Process**: Test → Build Docker → Push to ECR → Deploy to App Runner
- **Workflow**: `.github/workflows/deploy-backend.yml`

### Frontend (Vercel)
- **Trigger**: Push to `main` affecting `frontend/**`
- **Process**: Lint → Deploy to Vercel
- **Workflow**: `.github/workflows/deploy-frontend.yml`

Manual deploys can be triggered via GitHub Actions → Run workflow.

---

## Local Development

Local development workflow is unchanged:

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

The app uses SQLite locally by default. Set `DATABASE_URL` to use PostgreSQL locally if needed.

---

## Troubleshooting

### App Runner deployment stuck
```bash
aws apprunner describe-service \
    --service-arn YOUR_SERVICE_ARN \
    --query "Service.Status"
```

### Check App Runner logs
```bash
aws logs tail /aws/apprunner/ravenlens-backend/service \
    --follow --region us-west-2
```

### Vercel deployment failing
- Check build logs in Vercel dashboard
- Ensure `VITE_API_BASE_URL` is set in Vercel project settings
- Verify GitHub secrets are correctly set

### Database connection issues
- Ensure RDS security group allows inbound from App Runner's VPC
- Verify the DATABASE_URL format and credentials
- Check that the database name matches (`ravenlens`)

---

## Cost Estimates (us-west-2)

| Service | Estimated Monthly Cost |
|---------|------------------------|
| App Runner (1 vCPU, 2GB, low traffic) | ~$15-20 |
| RDS db.t3.micro | ~$15-20 |
| Vercel (frontend hosting) | Free |
| ECR (image storage) | <$1 |
| **Total** | **~$16-20/month** |

Free tier eligible services may reduce costs for the first 12 months.

---

## Security Notes

- All secrets are stored in GitHub Secrets (never in code)
- RDS is not publicly accessible (App Runner connects via AWS network)
- Docker runs as non-root user (`appuser`)
- IAM policies follow least-privilege principle
- RDS has deletion protection enabled
- Frontend served over HTTPS via Vercel's edge network
