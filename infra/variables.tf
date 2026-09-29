variable "vpc_cidr" {
  type        = string
  description = "CIDR block for vpc"
}
variable "availability_zones" {
  type        = list(string)
  description = "acceptable availability zones"
}
variable "private_subnet_cidrs" {
  type        = list(string)
  description = "CIDR block for private subnet"
}
variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR block for public subnet"
}
variable "DB_PASSWORD" {
  type      = string
  sensitive = true
}
variable "JWT_SECRET" {
  type      = string
  sensitive = true
}