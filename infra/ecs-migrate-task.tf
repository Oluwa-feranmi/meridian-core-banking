# ---------------------------------------------------------------------------
# ECS Task Definition for Database Migrations
# Runs: npm ci && npm run migrate && npm run seed
# This is a one-off task, not a long-running service.
# ---------------------------------------------------------------------------

resource "aws_ecs_task_definition" "migrate" {
  family                   = "meridian-migrate"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name             = "meridian-migrate"
      image            = "${aws_ecr_repository.this["backend"].repository_url}:latest"
      essential        = true
      workingDirectory = "/app"
      user             = "root"
      privileged       = false

      command = [
        "sh",
        "-c",
        "node scripts/migrate.js && node scripts/seed.js"
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "DB_HOST"
          value = aws_db_instance.meridian.address
        },
        {
          name  = "DB_PORT"
          value = tostring(aws_db_instance.meridian.port)
        },
        {
          name  = "DB_NAME"
          value = aws_db_instance.meridian.db_name
        },
        {
          name  = "DB_USER"
          value = aws_db_instance.meridian.username
        },
        {
          name  = "DB_SSL"
          value = "true"
        }
      ]

      secrets = [
        {
          name      = "DB_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.db_password.arn}:password::"
        },
        {
          name      = "JWT_SECRET"
          valueFrom = "${aws_secretsmanager_secret.jwt_secret.arn}:secret::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.migrate.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name = "meridian-migrate-task"
  }
}

# CloudWatch Log Group for migration task
resource "aws_cloudwatch_log_group" "migrate" {
  name              = "/ecs/meridian-migrate"
  retention_in_days = 7

  tags = {
    Name = "meridian-migrate-logs"
  }
}

# Secrets Manager secrets
# Note: You need to set the actual secret values using `aws secretsmanager put-secret-value`
# Terraform creates the secret resources, but you set the values separately.
resource "aws_secretsmanager_secret" "db_password" {
  name                    = "meridian/db-password"
  recovery_window_in_days = 7

  tags = {
    Name = "meridian-db-password"
  }
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "meridian/jwt-secret"
  recovery_window_in_days = 7

  tags = {
    Name = "meridian-jwt-secret"
  }
}

# Output the task definition for reference
output "migrate_task_definition_arn" {
  value       = aws_ecs_task_definition.migrate.arn
  description = "ARN of the migration task definition"
}

output "migrate_task_definition_name" {
  value       = aws_ecs_task_definition.migrate.family
  description = "Family name of the migration task definition"
}
