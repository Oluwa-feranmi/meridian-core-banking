# Meridian Core Banking Platform (MCBP)

**Repository name:** `meridian-core-banking`
**Tagline:** *A cloud-native core banking API, built for observability and built to shut off.*

---

## 1. Project Description

Meridian Core Banking Platform is a cloud-native REST API and web console that
performs real customer, account, and transaction management for a fictional
retail bank ("Meridian Trust Bank"). It is a portfolio project designed to
demonstrate the full lifecycle of a production banking service — schema
design, API engineering, containerization, deployment to AWS, and operational
monitoring — while staying inside AWS Free Tier limits and remaining safe to
run for short bursts (deploy → test → tear down) without risk of runaway
billing.

This is **not** a mock or "fake data" demo. Every deposit, withdrawal, and
transfer is a real write against a real PostgreSQL database, wrapped in real
transactional integrity guarantees.

## 2. Project Objective

To build and operate an application that would survive scrutiny in a real
Cloud Engineer / Platform Engineer / SRE / DevOps interview, specifically to
demonstrate:

- Designing a normalized, constraint-enforced relational schema for a
  regulated domain (finance) where correctness isn't optional.
- Building a REST API with real validation, structured logging, and audit
  trails — not just CRUD boilerplate.
- Containerizing an application correctly (multi-stage builds, non-root
  users, health checks).
- Reasoning about AWS architecture with a real constraint most tutorials
  ignore: **cost control for a system that only runs occasionally**, not
  24/7 production traffic.
- Building CloudWatch-based observability that an SRE would actually use
  during an incident.

## 3. Business Scenario

**Meridian Trust Bank** is a fictional regional retail bank modernizing its
core banking capability. Historically, account and transaction processing
ran on an overnight-batch mainframe system: deposits posted hours after they
happened, transfers required manual reconciliation, and there was no
real-time visibility into transaction failures or fraud.

Meridian's engineering leadership commissioned a new **cloud-native core
banking microservice** with the following requirements:

- Real-time (synchronous) balance updates — no more overnight batch posting.
- A single source of truth for customer and account data, with referential
  integrity enforced at the database level, not just in application code.
- A full audit trail of every change to money-bearing records, to satisfy
  internal compliance review (modeled loosely on SOX/PCI-style controls,
  without claiming actual regulatory compliance).
- A platform team that can observe the system's health (latency, error
  rate, DB connection pressure, failed transaction volume) without SSHing
  into a box and tailing a log file.
- Infrastructure that a small engineering team can run cost-effectively,
  since Meridian is a mid-size bank, not a hyperscaler — this is the
  in-universe justification for why the architecture below is deliberately
  lean (Fargate over EKS, no NAT Gateway, Parameter Store over Secrets
  Manager) rather than "biggest AWS bill possible."

## 4. Architecture Overview

```
                                 ┌─────────────────────┐
                                 │        Users         │
                                 │ (browser / API client)│
                                 └──────────┬───────────┘
                                            │ HTTPS
                                            ▼
                              ┌───────────────────────────┐
                              │  Application Load Balancer │
                              │   (public subnet, 2x AZ)   │
                              └──────────────┬─────────────┘
                                             │ HTTP (internal)
                             ┌───────────────┴────────────────┐
                             ▼                                 ▼
                  ┌────────────────────┐            ┌────────────────────┐
                  │  ECS Fargate Task   │            │  ECS Fargate Task   │
                  │  (backend API +     │   ...      │  frontend, static/  │
                  │   frontend served)  │            │  same task, see     │
                  │  public subnet, SG  │            │  Phase 4 notes)     │
                  │  locked to ALB SG   │            └────────────────────┘
                  └──────────┬──────────┘
                             │ port 5432, SG-to-SG only
                             ▼
                  ┌────────────────────┐
                  │   Amazon RDS for    │
                  │    PostgreSQL       │
                  │  (private subnet,   │
                  │   db.t4g.micro)     │
                  └──────────┬──────────┘
                             │
                  ┌──────────┴──────────┐
                  │   CloudWatch Logs /  │
                  │  Metrics / Alarms /  │
                  │        SNS           │
                  └───────────────────────┘

  Supporting, not in the data path:
  - ECR:            stores backend + frontend container images
  - IAM:             least-privilege roles for ECS task execution & task role
  - SSM Parameter    DB credentials & app secrets (SecureString), pulled
    Store:           into the container at task startup, never baked into
                     the image
```

**Request flow:** Client → ALB (HTTPS) → ECS Fargate task (API, in a public
subnet but only reachable from the ALB's security group) → RDS PostgreSQL
(private subnet, only reachable from the ECS task's security group). All
application, access, and audit logs stream to CloudWatch Logs; key metrics
(CPU, memory, request count, latency, DB connections, transaction
volume/failures) feed CloudWatch Dashboards and Alarms, which notify an SNS
topic on breach.

Full reasoning for every one of these resources — why it exists, what it
costs, and where it fits in your Terraform project — is in
`02-infrastructure-guidance.md`.

## 5. Cost Philosophy (recap of your constraint, so it's written down)

This project assumes a **deploy → smoke-test for ~10 minutes → tear down**
usage pattern, not a persistently-running service. Every infrastructure
recommendation in this project is filtered through:

1. Free Tier eligible where possible (RDS db.t4g.micro, ECR 500MB, CloudWatch
   basic tier, SNS first 1,000 notifications, S3 if used for static assets).
2. Where Free Tier doesn't apply, cost must scale with **actual usage**
   (per-second/per-request billing), not a flat hourly control-plane fee.
3. Hard ceiling of ~$1.00/hour for any single resource, with a strong
   preference for $0.
4. No service that keeps costing money if you forget to tear it down for a
   few extra hours (this is why NAT Gateway and EKS are explicitly excluded
   — see the infra doc for the numbers).

## 6. Technology Stack (preview — justified in later phases)

| Layer | Choice | Phase |
|---|---|---|
| Database | PostgreSQL 16 (Amazon RDS) | Phase 2 (this doc's sibling) |
| Backend | Node.js + TypeScript + Express | Phase 3 |
| Frontend | React + TypeScript (Vite) | Phase 4 |
| Containerization | Docker, multi-stage builds | Phase 5 |
| Testing | Jest, Supertest | Phase 6 |
| CI/CD | GitHub Actions (stages explained, not generated yet) | Phase 7 |
| Infra (you own this) | Terraform, AWS Free-Tier-first | ongoing |
