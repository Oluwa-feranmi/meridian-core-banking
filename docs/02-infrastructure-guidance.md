# Infrastructure Guidance (No Terraform — Reasoning Only)

You're writing the Terraform yourself, so this document is the "why" you
translate into `.tf` files. For every resource: why it exists, what problem
it solves, what it connects to, roughly what it costs at your usage pattern,
and where it typically lives in a Terraform project layout.

A suggested Terraform module layout (you decide the real one):

```
infra/
├── modules/
│   ├── networking/     (VPC, subnets, route tables, IGW, SGs)
│   ├── ecs/             (cluster, task definitions, services)
│   ├── rds/              (PostgreSQL instance, subnet group, parameter group)
│   ├── alb/               (load balancer, target groups, listeners)
│   ├── observability/      (CloudWatch dashboards, alarms, SNS)
│   └── iam/                 (task execution role, task role, policies)
└── environments/
    └── dev/                  (ties modules together, this is what you `apply`)
```

---

## 1. VPC

**Why it exists:** Every other network resource needs an isolated address
space. Without your own VPC you'd be deploying into the account default VPC,
which is fine for a toy but doesn't demonstrate you understand network
segmentation — a core Cloud Engineer skill.

**What problem it solves:** Isolates your banking app's network entirely
from anything else in your AWS account, and lets you control exactly what
can talk to what.

**Recommendation:** One VPC, small CIDR (e.g. `10.0.0.0/16`), two
Availability Zones for the ALB's minimum-2-AZ requirement.

**Cost:** $0. A VPC itself is free; you only pay for things attached to it
(NAT Gateways, certain endpoints) — which is exactly why we're cutting NAT.

**Terraform home:** `modules/networking/vpc.tf`

---

## 2. Public Subnets (x2, one per AZ)

**Why it exists:** The ALB requires subnets in at least two AZs, and — in
this cost-constrained design — the ECS Fargate tasks also live here (see
the NAT Gateway discussion below).

**What connects to it:** Internet Gateway (route `0.0.0.0/0` → IGW), the
ALB, and the ECS Fargate tasks' Elastic Network Interfaces.

**Cost:** $0 for the subnet itself.

**Terraform home:** `modules/networking/subnets.tf`

---

## 3. Private Subnets (x2, one per AZ)

**Why it exists:** RDS should never be directly reachable from the
internet, full stop — this is true in a $0 portfolio project exactly as
much as it's true in a real bank.

**What connects to it:** The RDS DB Subnet Group. No route to an Internet
Gateway or NAT Gateway needed, because RDS doesn't need outbound internet
access to function.

**Cost:** $0.

**Terraform home:** `modules/networking/subnets.tf`

---

## 4. Why there's no NAT Gateway (a deliberate omission)

A "standard" 3-tier reference architecture puts compute in a private subnet
and routes its outbound traffic through a NAT Gateway. I'm intentionally
**not** recommending that here, and you should be able to explain why in an
interview:

- NAT Gateway bills **hourly from creation to deletion** (~$0.045/hr in
  most regions) **plus** a per-GB data processing charge — regardless of
  whether it's actively used. Unlike Fargate or RDS, it does not scale to
  zero cost when idle; it's the single most common way a "cheap" AWS demo
  quietly runs up a bill.
- Your ECS tasks don't need outbound internet for anything except pulling
  the container image from ECR and reading CloudWatch/Parameter Store —
  and those can be reached via **VPC Gateway/Interface Endpoints** if you
  want a zero-public-IP design, or simply by placing the tasks in a public
  subnet with `assign_public_ip = true` and a Security Group that only
  allows **inbound** traffic from the ALB.
- Placing the ECS task in a public subnet does not mean it's publicly
  *reachable* — reachability is governed by the Security Group, not by
  which route table the subnet uses. A public-subnet ECS task with a
  properly locked-down SG is a legitimate, explainable trade-off for a
  short-lived, cost-constrained deployment.

**What to say if asked in an interview:** "In a persistent 24/7 production
system I'd put compute in a private subnet behind a NAT Gateway or NAT
instance. For this project, given a deploy/teardown usage pattern, the NAT
Gateway's flat hourly cost didn't pay for itself, so I used a public subnet
with security-group-level isolation instead — I know the difference and the
trade-off I'm making."

---

## 5. Security Groups

Three, each scoped to exactly what needs to talk to what:

| Security Group | Inbound allowed from | Purpose |
|---|---|---|
| `alb-sg` | `0.0.0.0/0` on 443 (and 80 → redirect to 443) | Public entry point |
| `ecs-task-sg` | `alb-sg` on the container port only | No other source can reach the app |
| `rds-sg` | `ecs-task-sg` on 5432 only | Database reachable only from the app, never from the internet or your laptop directly |

**Cost:** $0 — Security Groups are free.

**Terraform home:** `modules/networking/security_groups.tf`

---

## 6. IAM (least privilege)

Two roles matter for ECS Fargate specifically:

- **Task Execution Role** — used by the ECS agent itself, not your app
  code. Needs `ecr:GetDownloadUrlForLayer`/`BatchGetImage` (to pull your
  image), `logs:CreateLogStream`/`PutLogEvents` (to ship logs to
  CloudWatch), and `ssm:GetParameters`/`kms:Decrypt` scoped to your
  specific parameter path (to inject secrets at startup).
- **Task Role** — used by your *application code at runtime*, if it needs
  to call any AWS API directly (e.g., CloudWatch custom metrics via SDK,
  though for this project the ECS/CloudWatch agent handles most of that
  for you, so this role can start nearly empty and grow only if needed).

**Why separate them:** the execution role's job is "start the container,"
the task role's job is "let the running application call AWS APIs." Merging
them is a common over-privilege mistake — resist the urge to attach
`AdministratorAccess` to either for convenience, even in a demo; least
privilege is a thing you're actively demonstrating, not just describing.

**Cost:** $0 — IAM is free.

**Terraform home:** `modules/iam/roles.tf`, `modules/iam/policies.tf`

---

## 7. ECR (Elastic Container Registry)

**Why it exists:** Stores your built backend and frontend Docker images so
ECS can pull them.

**What connects to it:** `docker push` from your machine or CI; ECS task
execution role pulls from it at deploy time.

**Cost:** 500MB/month storage free (12-month Free Tier); your two small
images will comfortably fit. Data transfer to ECS within the same region is
free.

**Terraform home:** `modules/ecs/ecr.tf` (or its own `modules/ecr/`)

---

## 8. ECS on Fargate (cluster, task definitions, service)

**Why it exists:** Runs your containerized backend (and frontend, per the
Phase 4/5 discussion) without you managing EC2 instances.

**What problem it solves vs. EKS:** EKS charges a flat $0.10/hr **per
cluster** for the control plane alone, 24/7, regardless of whether any pods
are running — that's the exact "expensive even when idle" pattern you
correctly ruled out. Fargate has **no cluster-level charge**; you pay only
for the vCPU/memory of tasks while they're actually running, billed per
second (1-minute minimum). A small task (0.25 vCPU / 0.5GB) running for
your 10-minute test window costs a fraction of a cent.

**What problem it solves vs. ECS-on-EC2:** ECS-on-EC2 is also viable and
*can* be free-tier (750 hrs/month of t3.micro/t4g.micro), but only if you
remember to stop the instance — if you forget and leave it running, EC2
bills whether or not tasks are scheduled on it. Fargate has no such
"forgot to turn it off" failure mode, which matters a lot for your
deploy-then-walk-away workflow.

**What connects to it:** Pulls images from ECR, registers targets with the
ALB's target group, reads secrets from Parameter Store via the execution
role, connects outbound to RDS, ships logs/metrics to CloudWatch.

**Cost:** ~$0.04048/vCPU-hr + $0.004445/GB-hr (region-dependent). A single
0.25 vCPU / 0.5GB task for one hour ≈ $0.012; for your 10-minute test
window, effectively negligible.

**Terraform home:** `modules/ecs/cluster.tf`, `modules/ecs/task_definition.tf`, `modules/ecs/service.tf`

---

## 9. RDS for PostgreSQL

**Why it exists:** Your real, durable, ACID-compliant system of record for
customers, accounts, transactions, and audit logs (full schema in
`db/migrations/`).

**What connects to it:** Only the `ecs-task-sg` on port 5432.

**Cost:** Free Tier covers 750 instance-hours/month of db.t3.micro **or**
db.t4g.micro (12 months from account creation) plus 20GB General Purpose
SSD storage and 20GB backup storage. For your usage pattern this is
effectively $0. **Important:** set `skip_final_snapshot = true` and a short
backup retention window in your Terraform so `terraform destroy` doesn't
get blocked waiting on a final snapshot or leave a lingering snapshot
that (modestly) bills storage after teardown.

**Engine choice — why PostgreSQL over MySQL/MariaDB/SQL Server Express:**
- Native `NUMERIC`/`DECIMAL` handling is mature and this schema relies on
  `NUMERIC(19,4)` throughout for money — never floating point.
- `CHECK` constraints (e.g., `balance >= 0`) and `JSONB` (used for the
  audit log's before/after payloads) are first-class, well-optimized
  features.
- It's the more common default in modern cloud-native/fintech job
  postings, which matters for a portfolio piece's narrative relevance.
- SQL Server Express isn't available as an RDS Free Tier option in the
  same way; Aurora Serverless v2 has no true $0 floor (it has a minimum
  ACU charge) which conflicts with your cost ceiling philosophy for an
  intermittently-running system — plain RDS PostgreSQL with Free Tier is
  the better fit here.

**Terraform home:** `modules/rds/instance.tf`, `modules/rds/subnet_group.tf`, `modules/rds/parameter_group.tf`

---

## 10. Application Load Balancer

**Why it exists:** Public HTTPS entry point, health-checks your ECS tasks,
and gives you a stable DNS name instead of exposing task IPs directly.

**What connects to it:** Internet → ALB (443) → Target Group → ECS tasks
(container port).

**Cost:** ~$0.0225/hr + Load Capacity Units based on traffic. At demo-scale
traffic for a 10-minute window, this is a few cents at most — comfortably
under your $1/hr ceiling, and it's genuinely worth keeping for the health
check, target group, and HTTPS termination story it lets you tell.

**Terraform home:** `modules/alb/alb.tf`, `modules/alb/target_group.tf`, `modules/alb/listener.tf`

---

## 11. CloudWatch (Logs, Dashboards, Alarms)

**Why it exists:** This is one of the primary objectives of the project —
see Phase 6+ (Monitoring) for the full dashboard/alarm design. In brief:
ECS ships container stdout/stderr to CloudWatch Logs automatically via the
`awslogs` driver; ECS/RDS/ALB all publish default metrics to CloudWatch
Metrics at no extra cost; you build Dashboards and Alarms on top of those.

**Cost:** Free Tier includes 5GB log ingestion/storage, 10 custom metrics,
3 dashboards (up to 50 metrics each), and 10 alarms per month — more than
enough for a project of this scope.

**Terraform home:** `modules/observability/log_groups.tf`, `modules/observability/dashboards.tf`, `modules/observability/alarms.tf`

---

## 12. SNS

**Why it exists:** Delivers CloudWatch Alarm notifications (e.g., "5xx
error rate exceeded 5% for 5 minutes," "DB connections near max") to your
email, closing the loop from "metric breached a threshold" to "human gets
notified."

**Cost:** First 1,000 email notifications/month free.

**Terraform home:** `modules/observability/sns.tf`

---

## 13. Systems Manager Parameter Store (instead of Secrets Manager)

**Why it exists:** Holds DB connection string, DB password, and any app
secrets as `SecureString` parameters, injected into the ECS task at
startup via the task execution role — never baked into the Docker image or
committed to Git.

**Why Parameter Store over Secrets Manager here:** Secrets Manager charges
~$0.40/secret/month **plus** API call charges, billed regardless of how
many hours your app is actually running — the same "flat recurring cost"
pattern you're avoiding elsewhere. Parameter Store's Standard tier
(SecureString, using the AWS-managed KMS key) is free and gives you the
same "not hardcoded in the image" story for this project's scale.
**What I'd say if asked "why not Secrets Manager":** Secrets Manager adds
automatic rotation and cross-account resource policies, which matter more
in a persistent production system with a real secret-rotation cadence;
for a short-lived demo, Parameter Store SecureString is the pragmatic,
Free-Tier-aligned choice, and I know the upgrade path if requirements
changed.

**Terraform home:** `modules/iam/policies.tf` (grants read), parameters
themselves typically live in `environments/dev/parameters.tf` since
they're environment-specific.

---

## 14. Cost Summary Table

| Resource | Idle cost if left running | Your 10-min test cost | Notes |
|---|---|---|---|
| VPC / Subnets / SGs | $0 | $0 | Always free |
| IAM | $0 | $0 | Always free |
| ECR | $0 (under 500MB) | $0 | Free Tier |
| ECS Fargate task | **$0** (scales to zero when stopped) | ~$0.002–0.01 | Pay-per-second |
| RDS db.t4g.micro | ~$0.016/hr after Free Tier hours used | ~$0 | 750 hrs/mo free for 12 months |
| ALB | ~$0.0225/hr + LCUs | ~$0.01 | Kept for the health-check/HTTPS story |
| CloudWatch | $0 (under free tier caps) | $0 | 5GB logs, 10 alarms free |
| SNS | $0 (under 1,000 notif/mo) | $0 | |
| Parameter Store | $0 | $0 | Standard tier |
| ~~NAT Gateway~~ | ~~$0.045/hr + data~~ | — | **Excluded** |
| ~~EKS~~ | ~~$0.10/hr control plane~~ | — | **Excluded** |

Nothing here approaches your $1/hr ceiling — the realistic total for a
10-minute deploy/test/teardown cycle is well under $0.05, and the only
resource with any idle cost at all if you forget to tear down (RDS, after
Free Tier hours are exhausted) is pennies per hour, not dollars.
