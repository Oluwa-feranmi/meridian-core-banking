resource "aws_lb" "meridian-lb" {
  name               = "meridian-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false

  tags = {
    Name = "Meridian-alb"
  }
}

resource "aws_lb_target_group" "frontend-target-group" {
  name        = "meridian-frontend-alb-tg"
  target_type = "ip"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id

  health_check {
    port     = 80
    protocol = "HTTP"
    path     = "/nginx-health"
  }
}

resource "aws_lb_target_group" "backend-target-group" {
  name        = "meridian-backend-alb-tg"
  target_type = "ip"
  port        = 4000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id

  health_check {
    port     = 4000
    protocol = "HTTP"
    path     = "/health/ready"
  }
}

resource "aws_lb_listener" "front_end" {
  load_balancer_arn = aws_lb.meridian-lb.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend-target-group.arn
  }
}

# Rule 1: Route /api/* to backend (priority 1)
resource "aws_lb_listener_rule" "api-to-backend" {
  listener_arn = aws_lb_listener.front_end.arn
  priority     = 1

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend-target-group.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}
