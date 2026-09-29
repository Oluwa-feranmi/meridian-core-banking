#!/bin/bash

# Create IAM roles for ECS tasks
set -e

ACCOUNT_ID="224039895487"
REGION="eu-west-1"

echo "Creating ecsTaskExecutionRole..."
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "ecs-tasks.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }' \
  --region $REGION 2>/dev/null || echo "Role already exists"

echo "Attaching execution policy..."
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy \
  --region $REGION 2>/dev/null || echo "Policy already attached"

echo "Adding Secrets Manager permissions to ecsTaskExecutionRole..."
aws iam put-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-name SecretsManagerAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ],
        "Resource": [
          "arn:aws:secretsmanager:'$REGION':'$ACCOUNT_ID':secret:meridian/*"
        ]
      },
      {
        "Effect": "Allow",
        "Action": [
          "kms:Decrypt"
        ],
        "Resource": "*"
      }
    ]
  }' \
  --region $REGION 2>/dev/null || echo "Policy already exists"

echo "Creating ecsTaskRole..."
aws iam create-role \
  --role-name ecsTaskRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "ecs-tasks.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }' \
  --region $REGION 2>/dev/null || echo "Role already exists"

echo ""
echo "✓ IAM roles created successfully!"
echo ""
echo "Next, create the secrets:"
echo "aws secretsmanager create-secret --name meridian/db-password --secret-string '{\"password\":\"YOUR_RDS_PASSWORD\"}' --region $REGION"
echo "aws secretsmanager create-secret --name meridian/jwt-secret --secret-string '{\"secret\":\"your-jwt-secret-min-16-chars\"}' --region $REGION"
