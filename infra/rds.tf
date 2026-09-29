resource "aws_db_instance" "meridian" {
  allocated_storage       = 10
  db_name                 = "meridian"
  engine                  = "postgres"
  engine_version          = "16"
  instance_class          = "db.t3.micro"
  username                = "meridian"
  password                = var.DB_PASSWORD
  parameter_group_name    = aws_db_parameter_group.meridian.name
  skip_final_snapshot     = true
  deletion_protection     = false
  db_subnet_group_name    = aws_db_subnet_group.db-subnet-group.name
  vpc_security_group_ids  = [aws_security_group.rds-sg.id]
  publicly_accessible     = false
  backup_retention_period = 0
  identifier              = "meridian-db"
}
resource "aws_db_parameter_group" "meridian" {
  name   = "meridian-postgres16"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "0"
  }

  tags = {
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
resource "aws_db_subnet_group" "db-subnet-group" {
  name        = "meridian-db-subnet-group"
  subnet_ids  = aws_subnet.private[*].id
  description = "Subnet group for db instance"

  tags = {
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}