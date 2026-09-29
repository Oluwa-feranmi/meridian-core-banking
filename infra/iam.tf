# ---------------------------------------------------------------------------
# Task Execution Role — used by the ECS agent itself to start the container:
# pull the image from ECR, ship logs to CloudWatch, read secrets from SSM.
# ---------------------------------------------------------------------------
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "meridian_ecs_task_execution_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Sid    = ""
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      },
    ]
  })

  tags = {
    Name = "meridian_ecs_task_execution_role"
  }
}

# AWS's own pre-built policy covering ECR image pulls + CloudWatch Logs
# writes — no need to write these permissions ourselves.
resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Data sources to build the SSM parameter ARN dynamically, instead of
# hardcoding the account ID and region as literal strings.
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Custom, tightly-scoped policy for reading this app's own config out of
# Parameter Store — not covered by the managed policy above, and not
# something AWS could pre-build for us since the path is project-specific.
data "aws_iam_policy_document" "ecs_ssm_read" {
  statement {
    sid = "ReadMeridianParameters"

    actions = [
      "ssm:GetParameters",
      "ssm:GetParametersByPath",
    ]

    resources = [
      "arn:aws:ssm:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:parameter/meridian/*",
    ]
  }
}

resource "aws_iam_policy" "ecs_ssm_read_policy" {
  name        = "meridian_ecs_ssm_read_policy"
  path        = "/"
  description = "Allows the ECS task execution role to read Meridian's config from SSM Parameter Store"
  policy      = data.aws_iam_policy_document.ecs_ssm_read.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution_ssm" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = aws_iam_policy.ecs_ssm_read_policy.arn
}

# Custom policy for reading secrets from Secrets Manager (for migrations)
data "aws_iam_policy_document" "ecs_secrets_manager_read" {
  statement {
    sid = "ReadMeridianSecrets"

    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
    ]

    resources = [
      "arn:aws:secretsmanager:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:secret:meridian/*",
    ]
  }

  statement {
    sid = "DecryptSecrets"

    actions = [
      "kms:Decrypt",
    ]

    resources = ["*"]
  }
}

resource "aws_iam_policy" "ecs_secrets_manager_policy" {
  name        = "meridian_ecs_secrets_manager_policy"
  path        = "/"
  description = "Allows the ECS task execution role to read Meridian's secrets from Secrets Manager"
  policy      = data.aws_iam_policy_document.ecs_secrets_manager_read.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution_secrets_manager" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = aws_iam_policy.ecs_secrets_manager_policy.arn
}

# ---------------------------------------------------------------------------
# Task Role — used by the application code itself at runtime, if it ever
# needs to call an AWS API directly. Currently empty: the app only talks
# to RDS and the frontend, neither of which requires AWS permissions.
# Grow this later only if a real need appears — don't pre-grant "just in
# case."
# ---------------------------------------------------------------------------
resource "aws_iam_role" "ecs_task_role" {
  name = "meridian_ecs_task_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Sid    = ""
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      },
    ]
  })

  tags = {
    Name = "meridian_ecs_task_role"
  }
}
