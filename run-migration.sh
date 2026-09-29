#!/bin/bash

# ECS Migration Task Runner for Meridian
# This script registers the task definition and runs the migration

set -e

CLUSTER="meridian-cluster"
REGION="eu-west-1"
SUBNET="subnet-0f19c973703762194"
SECURITY_GROUP="sg-0bd422336d4b75802"

echo "Registering task definition..."
aws ecs register-task-definition \
  --cli-input-json file://ecs-task-definition-migrate.json \
  --region $REGION

echo "Running migration task..."
aws ecs run-task \
  --cluster $CLUSTER \
  --task-definition meridian-migrate:1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET],securityGroups=[$SECURITY_GROUP],assignPublicIp=ENABLED}" \
  --region $REGION

echo ""
echo "Migration task started! Check the logs with:"
echo "aws logs tail /ecs/meridian-migrate --follow --region $REGION"
