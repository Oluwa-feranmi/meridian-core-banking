# Infrastructure (Terraform)

This directory contains all infrastructure-as-code for deploying Meridian to AWS.

## Structure

- `*.tf` — Terraform resource definitions (VPC, RDS, ECS, ALB, IAM, etc.)
- `scripts/` — Operational scripts for ongoing management
- `terraform.tfvars` — Your environment variables (DO NOT commit to git)

## Deployment

### Initial Setup

```bash
terraform init
terraform plan
terraform apply
```

### Updating Running Services

After code changes, rebuild and push Docker images, then force ECS redeployment:

```bash
# Backend
docker build -t <ecr-uri>/meridian-backend:latest -f backend/Dockerfile.aws .
docker push <ecr-uri>/meridian-backend:latest
aws ecs update-service --cluster meridian-cluster --service meridian-backend --force-new-deployment --region eu-west-1

# Frontend  
docker build -t <ecr-uri>/meridian-frontend:latest --build-arg VITE_API_BASE_URL=http://<alb-dns>/api -f frontend/Dockerfile .
docker push <ecr-uri>/meridian-frontend:latest
aws ecs update-service --cluster meridian-cluster --service meridian-frontend --force-new-deployment --region eu-west-1
```

## Database Migrations

**Why this approach?** 

RDS is intentionally placed in a **private subnet** — it's not accessible from the internet. This is a security best practice, but it means you cannot:
- SSH into a bastion host to run migrations
- Run `psql` from your laptop against production RDS
- Use traditional database migration tools that assume internet access

Instead, migrations run as a **one-off Fargate task** that:
1. Starts inside the same VPC as RDS
2. Runs `migrate.js` and `seed.js` 
3. Exits cleanly
4. Leaves no permanent infrastructure behind

This is the standard AWS production pattern for private databases.

### Running Migrations

```bash
bash infra/scripts/run-migration.sh
```

Or manually:

```bash
aws ecs run-task \
  --cluster meridian-cluster \
  --task-definition meridian-migrate \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<subnet>],securityGroups=[<sg>],assignPublicIp=ENABLED}" \
  --region eu-west-1

aws logs tail /ecs/meridian-migrate --follow --region eu-west-1
```

Replace `<subnet>` and `<sg>` with your private subnet and RDS security group IDs.

## Architecture Decisions

### Private RDS in Private Subnet
- ✅ Secure (not internet-facing)
- ✅ Cheaper (no NAT Gateway needed)
- ❌ Requires one-off migration task for operational access
- ❌ Cannot run interactive `psql` against production

### Single-Host ECS (No Auto Scaling)
- ✅ Simple, good for early-stage apps
- ❌ No high availability — single task failure = downtime
- Plan: Migrate to ECS Service with multiple tasks + ALB target groups

## Outputs

After `terraform apply`, retrieve outputs:

```bash
terraform output lb_dns_name        # ALB DNS for browser access
terraform output rds_endpoint       # RDS hostname (internal only)
terraform output ecr_backend_uri    # ECR registry for backend image
terraform output ecr_frontend_uri   # ECR registry for frontend image
```

## Destroying Infrastructure

```bash
terraform destroy
```

⚠️ This **deletes everything**: VPC, RDS, ECS cluster, ALB, and all data.
