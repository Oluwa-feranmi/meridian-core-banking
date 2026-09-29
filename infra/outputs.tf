output "load-balancer-dns" {
  value = aws_lb.meridian-lb.dns_name
}
output "account-id" {
  value = data.aws_caller_identity.current.account_id
}