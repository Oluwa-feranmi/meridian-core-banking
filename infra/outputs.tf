output "lb_dns_name" {
  value       = aws_lb.meridian-lb.dns_name
  description = "ALB DNS name for accessing the app"
}

output "account_id" {
  value       = data.aws_caller_identity.current.account_id
  description = "AWS Account ID"
}

output "private_subnet_ids" {
  value       = join(",", aws_subnet.private[*].id)
  description = "Private subnet IDs for migration task"
}

output "rds_security_group_id" {
  value       = aws_security_group.rds-sg.id
  description = "RDS security group ID for migration task"
}

output "ecr_backend_uri" {
  value       = aws_ecr_repository.this["backend"].repository_url
  description = "ECR repository URL for backend image"
}

output "ecr_frontend_uri" {
  value       = aws_ecr_repository.this["frontend"].repository_url
  description = "ECR repository URL for frontend image"
}

output "rds_endpoint" {
  value       = aws_db_instance.meridian.address
  description = "RDS endpoint (internal only, not accessible from internet)"
}
