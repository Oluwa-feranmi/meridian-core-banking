resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "meridian_vpc"
  }
}
resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]
  vpc_id            = aws_vpc.main.id

  tags = {
    Name = "meridian_private_subnet_${count.index}"
  }
}
resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  vpc_id                  = aws_vpc.main.id
  map_public_ip_on_launch = true

  tags = {
    Name = "meridian_public_subnet_${count.index}"
  }

}
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "meridian_rt"
  }
}
resource "aws_route_table_association" "private" {
  count          = length(var.private_subnet_cidrs)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}
resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "meridian_igw"
  }
}
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }

  tags = {
    Name = "meridian_public_rt"
  }

}
resource "aws_route_table_association" "public" {
  count          = length(var.public_subnet_cidrs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id

}
resource "aws_security_group" "alb" {
  name        = "meridian_alb_sg"
  description = "Security group for ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "meridian_alb_sg"
  }

}
resource "aws_security_group" "ecs-task" {
  name        = "meridian_ecs_task_sg"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "meridian_ecs_task_sg"
  }

}
resource "aws_security_group" "rds-sg" {
  name        = "meridian_rds_sg"
  description = "Security group for RDS"
  vpc_id      = aws_vpc.main.id


  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs-task.id]
  }

  tags = {
    Name = "meridian_rds_sg"
  }

}
resource "aws_security_group_rule" "alb_to_ecs_task" {
  type                     = "egress"
  security_group_id        = aws_security_group.alb.id
  source_security_group_id = aws_security_group.ecs-task.id
  from_port                = 4000
  to_port                  = 4000
  protocol                 = "tcp"

}

resource "aws_security_group_rule" "ecs_task_from_alb" {
  type                     = "ingress"
  security_group_id        = aws_security_group.ecs-task.id
  source_security_group_id = aws_security_group.alb.id
  from_port                = 4000
  to_port                  = 4000
  protocol                 = "tcp"

}
resource "aws_security_group_rule" "alb_to_ecs_task_80" {
  type                     = "egress"
  security_group_id        = aws_security_group.alb.id
  source_security_group_id = aws_security_group.ecs-task.id
  from_port                = 80
  to_port                  = 80
  protocol                 = "tcp"
}

resource "aws_security_group_rule" "ecs_task_from_alb_80" {
  type                     = "ingress"
  security_group_id        = aws_security_group.ecs-task.id
  source_security_group_id = aws_security_group.alb.id
  from_port                = 80
  to_port                  = 80
  protocol                 = "tcp"
}