resource "aws_ecr_repository" "this" {
  for_each             = toset(["frontend", "backend"])
  name                 = "meridian-${each.key}"
  image_tag_mutability = "IMMUTABLE_WITH_EXCLUSION"

  image_scanning_configuration {
    scan_on_push = true
  }
  image_tag_mutability_exclusion_filter {
    filter      = "latest*"
    filter_type = "WILDCARD"
  }
  force_delete = true
  tags = {
    Name        = "meridian-${each.key}-ecr"
    Project     = "meridian-core-banking"
    Environment = "dev"
    ManagedBy   = "Terraform"
  }
}
resource "aws_ecr_lifecycle_policy" "this" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 5 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })

}