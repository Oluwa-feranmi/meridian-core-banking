resource "aws_sns_topic" "meridian" {
  name = "meridian"
}
resource "aws_sns_topic_subscription" "meridian_user_updates" {
  topic_arn = aws_sns_topic.meridian.arn
  protocol  = "email"
  endpoint  = "oluwaferanmiayanwale@gmail.com"
}
resource "aws_sns_topic_policy" "meridian_topic_policy" {
  arn    = aws_sns_topic.meridian.arn
  policy = data.aws_iam_policy_document.sns_topic_policy.json

}
data "aws_iam_policy_document" "sns_topic_policy" {
  statement {
    sid    = "SNSPublishPolicy"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }
    actions   = ["SNS:Publish"]
    resources = [aws_sns_topic.meridian.arn]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}
resource "aws_cloudwatch_metric_alarm" "backend_5xx_error_rate" {
  alarm_name          = "backend 5xx error rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Sum"
  threshold           = "5"

  dimensions = {
    TargetGroup  = aws_lb_target_group.backend-target-group.arn_suffix
    LoadBalancer = aws_lb.meridian-lb.arn_suffix
  }
  alarm_description = "backend error rate"
  alarm_actions     = [aws_sns_topic.meridian.arn]
}
resource "aws_cloudwatch_metric_alarm" "cpu" {
  alarm_name          = "meridian-backend-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "60"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "Backend service CPU utilization is above 80%"
  alarm_actions       = [aws_sns_topic.meridian.arn]

  dimensions = {
    ClusterName = aws_ecs_cluster.meridian-cluster.name
    ServiceName = aws_ecs_service.backend.name
  }
}

resource "aws_cloudwatch_metric_alarm" "memory" {
  alarm_name          = "meridian-backend-memory-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "60"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "Backend service memory utilization is above 80%"
  alarm_actions       = [aws_sns_topic.meridian.arn]

  dimensions = {
    ClusterName = aws_ecs_cluster.meridian-cluster.name
    ServiceName = aws_ecs_service.backend.name
  }
}

resource "aws_cloudwatch_metric_alarm" "db_connections" {
  alarm_name          = "meridian-db-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "60"
  statistic           = "Average"
  threshold           = "40"
  alarm_description   = "RDS connection count is unexpectedly high"
  alarm_actions       = [aws_sns_topic.meridian.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.meridian.id
  }
}

resource "aws_cloudwatch_log_metric_filter" "failed_transactions" {
  name           = "meridian-failed-transactions"
  log_group_name = aws_cloudwatch_log_group.backend.name
  pattern        = "{ $.code = \"INSUFFICIENT_FUNDS\" }"

  metric_transformation {
    name          = "FailedTransactionCount"
    namespace     = "Meridian/Application"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "failed_transactions" {
  alarm_name          = "meridian-failed-transactions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FailedTransactionCount"
  namespace           = "Meridian/Application"
  period              = "300"
  statistic           = "Sum"
  threshold           = "3"
  alarm_description   = "More than 3 failed (insufficient funds) transactions in 5 minutes"
  alarm_actions       = [aws_sns_topic.meridian.arn]
  treat_missing_data  = "notBreaching"
}