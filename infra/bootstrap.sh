#!/bin/bash
# RavenLens AWS Infrastructure Bootstrap Script
# Run this script once to create all required AWS resources

set -euo pipefail

AWS_REGION="us-west-2"
ECR_REPO_NAME="ravenlens-backend"
RDS_IDENTIFIER="ravenlens-db"
RDS_DB_NAME="ravenlens"
RDS_USERNAME="ravenlens_user"
IAM_ROLE_NAME="ravenlens-apprunner-task-role"

echo "=============================================="
echo "RavenLens AWS Infrastructure Bootstrap"
echo "Region: $AWS_REGION"
echo "=============================================="

# -----------------------------------------
# 1. Create ECR Repository
# -----------------------------------------
echo ""
echo "[1/4] Creating ECR repository..."

if aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" --region "$AWS_REGION" 2>/dev/null; then
    echo "ECR repository '$ECR_REPO_NAME' already exists, skipping..."
else
    aws ecr create-repository \
        --repository-name "$ECR_REPO_NAME" \
        --region "$AWS_REGION" \
        --image-scanning-configuration scanOnPush=true \
        --encryption-configuration encryptionType=AES256

    echo "ECR repository created successfully"
fi

ECR_URI=$(aws ecr describe-repositories \
    --repository-names "$ECR_REPO_NAME" \
    --region "$AWS_REGION" \
    --query "repositories[0].repositoryUri" \
    --output text)

echo "ECR URI: $ECR_URI"

# -----------------------------------------
# 2. Create RDS PostgreSQL Instance
# -----------------------------------------
echo ""
echo "[2/4] Creating RDS PostgreSQL instance..."

# Generate secure random password
RDS_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)

if aws rds describe-db-instances --db-instance-identifier "$RDS_IDENTIFIER" --region "$AWS_REGION" 2>/dev/null; then
    echo "RDS instance '$RDS_IDENTIFIER' already exists, skipping..."
    echo ""
    echo "WARNING: Cannot retrieve existing password. Check AWS Secrets Manager or your records."
else
    aws rds create-db-instance \
        --db-instance-identifier "$RDS_IDENTIFIER" \
        --db-instance-class db.t3.micro \
        --engine postgres \
        --engine-version "15" \
        --allocated-storage 20 \
        --storage-type gp3 \
        --db-name "$RDS_DB_NAME" \
        --master-username "$RDS_USERNAME" \
        --master-user-password "$RDS_PASSWORD" \
        --no-publicly-accessible \
        --deletion-protection \
        --backup-retention-period 7 \
        --region "$AWS_REGION"

    echo ""
    echo "=============================================="
    echo "IMPORTANT: SAVE THIS PASSWORD SECURELY!"
    echo "=============================================="
    echo "RDS Master Password: $RDS_PASSWORD"
    echo "=============================================="
    echo ""
    echo "RDS instance is being created (takes ~5-10 minutes)..."
fi

# -----------------------------------------
# 3. Create IAM Role for App Runner
# -----------------------------------------
echo ""
echo "[3/4] Creating IAM role for App Runner..."

TRUST_POLICY=$(cat <<'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "tasks.apprunner.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF
)

if aws iam get-role --role-name "$IAM_ROLE_NAME" 2>/dev/null; then
    echo "IAM role '$IAM_ROLE_NAME' already exists, skipping creation..."
else
    aws iam create-role \
        --role-name "$IAM_ROLE_NAME" \
        --assume-role-policy-document "$TRUST_POLICY" \
        --description "Task role for RavenLens App Runner service"

    echo "IAM role created successfully"
fi

# -----------------------------------------
# 4. Attach Bedrock Policy to IAM Role
# -----------------------------------------
echo ""
echo "[4/4] Attaching Bedrock permissions to IAM role..."

BEDROCK_POLICY=$(cat <<'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "BedrockInvoke",
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream"
            ],
            "Resource": "*"
        }
    ]
}
EOF
)

aws iam put-role-policy \
    --role-name "$IAM_ROLE_NAME" \
    --policy-name "BedrockInvokePolicy" \
    --policy-document "$BEDROCK_POLICY"

echo "Bedrock policy attached successfully"

# -----------------------------------------
# Summary
# -----------------------------------------
echo ""
echo "=============================================="
echo "BOOTSTRAP COMPLETE"
echo "=============================================="
echo ""
echo "Resources created:"
echo "  - ECR Repository: $ECR_URI"
echo "  - RDS Instance: $RDS_IDENTIFIER (PostgreSQL 15)"
echo "  - IAM Role: $IAM_ROLE_NAME"
echo ""
echo "=============================================="
echo "NEXT STEPS:"
echo "=============================================="
echo ""
echo "1. SAVE THE DATABASE PASSWORD printed above (if this was a new RDS instance)"
echo ""
echo "2. Wait for RDS to be available (~5-10 minutes):"
echo "   aws rds wait db-instance-available --db-instance-identifier $RDS_IDENTIFIER --region $AWS_REGION"
echo ""
echo "3. Get the RDS endpoint:"
echo "   aws rds describe-db-instances --db-instance-identifier $RDS_IDENTIFIER --query 'DBInstances[0].Endpoint.Address' --output text"
echo ""
echo "4. Set up Vercel for frontend deployment:"
echo "   - Import the frontend/ folder at vercel.com"
echo "   - Run 'npx vercel link' in frontend/ to get VERCEL_ORG_ID and VERCEL_PROJECT_ID"
echo "   - Get VERCEL_TOKEN from Vercel account settings"
echo ""
echo "5. Add GitHub Secrets to your repository:"
echo "   - AWS_ACCESS_KEY_ID"
echo "   - AWS_SECRET_ACCESS_KEY"
echo "   - VERCEL_TOKEN"
echo "   - VERCEL_ORG_ID"
echo "   - VERCEL_PROJECT_ID"
echo "   - VITE_API_BASE_URL (your App Runner service URL)"
echo "   - DATABASE_URL (postgresql://$RDS_USERNAME:<password>@<rds-endpoint>:5432/$RDS_DB_NAME)"
echo ""
echo "6. Create App Runner service in AWS Console for first deploy"
echo ""
echo "=============================================="
