resource "aws_ecs_cluster" "meridian-cluster" {
  name = "meridian-cluster"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_service" "backend" {
  name            = "meridian-backend"
  cluster         = aws_ecs_cluster.meridian-cluster.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs-task.id]
    assign_public_ip = true
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.backend-target-group.arn
    container_name   = "backend"
    container_port   = 4000
  }
  health_check_grace_period_seconds = 60
}


resource "aws_ecs_task_definition" "backend" {
  family                   = "meridian-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  task_role_arn            = aws_iam_role.ecs_task_role.arn
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  depends_on               = [aws_iam_role_policy_attachment.ecs_execution_managed, aws_iam_role_policy_attachment.ecs_execution_ssm]

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "${aws_ecr_repository.this["backend"].repository_url}:latest"
      cpu       = 256
      memory    = 512
      essential = true
      portMappings = [
        {
          containerPort = 4000
          hostPort      = 4000
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = data.aws_region.current.region
          "awslogs-stream-prefix" = "ecs"
        }
      }
      secrets = [
        {
          name      = "DB_PASSWORD"
          valueFrom = aws_ssm_parameter.db-secret.arn
        },
        {
          name      = "JWT_SECRET"
          valueFrom = aws_ssm_parameter.jwt-secret.arn
        },
      ]
      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = "4000"
        },

        {
          name  = "LOG_LEVEL"
          value = "info"
        },
        {
          name  = "DB_USER"
          value = aws_db_instance.meridian.username
        },
        {
          name  = "DB_SSL"
          value = "false"
        },
        {
          name  = "DB_POOL_MAX"
          value = "10"
        },
        {
          name  = "DB_NAME"
          value = aws_db_instance.meridian.db_name
        },
        {
          name  = "DB_HOST"
          value = aws_db_instance.meridian.address
        },
        {
          name  = "DB_IDLE_TIMEOUT_MS"
          value = "30000"
        },
        {
          name  = "JWT_EXPIRES_IN"
          value = "8h"
        },
        {
          name  = "BCRYPT_SALT_ROUNDS"
          value = "12"
        },
        {
          name  = "CORS_ORIGIN"
          value = "http://${aws_lb.meridian-lb.dns_name}"
        },
        {
          name  = "RATE_LIMIT_WINDOW_MS"
          value = "60000"
        },
        {
          name  = "RATE_LIMIT_MAX_REQUESTS"
          value = "100"
        },
        {
          name  = "DB_PORT"
          value = "5432"
        }
      ]
    }
  ])
}
resource "aws_ecs_service" "frontend" {
  name            = "meridian-frontend"
  cluster         = aws_ecs_cluster.meridian-cluster.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs-task.id]
    assign_public_ip = true
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.frontend-target-group.arn
    container_name   = "frontend"
    container_port   = 80
  }
  health_check_grace_period_seconds = 60

}
resource "aws_ecs_task_definition" "frontend" {
  family                   = "meridian-frontend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  task_role_arn            = aws_iam_role.ecs_task_role.arn
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  depends_on               = [aws_iam_role_policy_attachment.ecs_execution_managed, aws_iam_role_policy_attachment.ecs_execution_ssm]

  container_definitions = jsonencode([
    {
      name      = "frontend"
      image     = "${aws_ecr_repository.this["frontend"].repository_url}:latest"
      cpu       = 256
      memory    = 512
      essential = true
      portMappings = [
        {
          containerPort = 80
          hostPort      = 80
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.frontend.name
          "awslogs-region"        = data.aws_region.current.region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

}
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/meridian/backend"
  retention_in_days = 1

  tags = {
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/meridian/frontend"
  retention_in_days = 1

  tags = {
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
resource "aws_ssm_parameter" "db-secret" {
  name        = "/meridian/DB_PASSWORD"
  description = "The database password"
  type        = "SecureString"
  value       = var.DB_PASSWORD

  tags = {
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
resource "aws_ssm_parameter" "jwt-secret" {
  name        = "/meridian/JWT_SECRET"
  description = "Jwt secrets"
  type        = "SecureString"
  value       = var.JWT_SECRET

  tags = {
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}