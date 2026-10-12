#!/bin/bash
# Run database migrations and seeds in AWS ECS
# 
# Why this exists: RDS is intentionally in a private subnet (secure, not 
# internet-facing). This means you cannot SSH into a bastion host or run 
# migrations from your local machine against production. Instead, we run 
# migrations as a one-off Fargate task that can reach the private RDS 
# instance through the VPC.
#
# Usage:
#   ./infra/scripts/run-migration.sh
#
# Prerequisites:
#   - AWS CLI configured
#   - Terraform state shows meridian-cluster and meridian-migrate task definition
#   - RDS credentials match what's in terraform.tfvars

set -e

CLUSTER="meridian-cluster"
REGION="eu-west-1"

# Fetch subnet and security group from Terraform outputs (dynamically)
echo "Fetching network configuration from Terraform state..."

SUBNET=$(cd infra && terraform output -raw private_subnet_ids | cut -d',' -f1 | xargs)
SECURITY_GROUP=$(cd infra && terraform output -raw rds_security_group_id)

if [ -z "$SUBNET" ] || [ -z "$SECURITY_GROUP" ]; then
  echo "Error: Could not fetch subnet or security group from Terraform"
  echo "Make sure you've run 'terraform apply' and have outputs defined"
  exit 1
fi

echo "Using subnet: $SUBNET"
echo "Using security group: $SECURITY_GROUP"
echo ""

echo "Starting migration task in $CLUSTER..."
TASK_ARN=$(aws ecs run-task \
  --cluster $CLUSTER \
  --task-definition meridian-migrate \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET],securityGroups=[$SECURITY_GROUP],assignPublicIp=ENABLED}" \
  --region $REGION \
  --query 'tasks[0].taskArn' \
  --output text)

echo "Task started: $TASK_ARN"
echo ""
echo "Watching logs (Ctrl+C to stop watching, task will continue):"
aws logs tail /ecs/meridian-migrate --follow --region $REGION
