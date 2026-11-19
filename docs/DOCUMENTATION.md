# Work log — containerisation and AWS deployment

A record of the containerisation and deployment work on branch
`feature/docker-aws-deployment`: what was decided, why, what was built, and how it was
verified. For the step-by-step AWS setup itself, see **[`DEPLOYMENT.md`](DEPLOYMENT.md)** —
this file is the history and the reasoning, that one is the runbook.

| | |
|---|---|
| Branch | `feature/docker-aws-deployment`, created from `main` at `4882cc0` |
| Started | 19 November 2026 |
| State | Code complete and verified locally. AWS resources not created yet. Nothing committed yet. |

---

## 1. Starting point

Before this work the application was feature-complete (Phases 1–8, the AI assistant, README
and ER diagram — see [`PLAN.md`](PLAN.md)) but ran only as a local `mvnw spring-boot:run` +
`npm run dev`. Deployment was the one open item in Phase 9.

### Notes from the codebase review

A full read-through of the code preceded this work. These points were noticed and **left
unchanged** — they are outside the deployment scope, but worth knowing before a review or the
live-coding round:

1. **Team size counts managers and disabled accounts.** `DashboardService.summary` uses
   `userRepository.count()`. With the demo data, compliance reads 2 of 6 (33%), and both
   managers appear as "not started". `weekStatus`, the status-by-member chart and the
   assistant's roster also include everyone. A comment in `SectionComparePage` says "enabled
   accounts", but nothing filters them.
2. **The team dashboard's report list is not scoped to the selected week.** The week picker
   drives the tiles, charts and "Filed this week" panel; the list shows every week unless a
   range filter is set.
3. **`ReportReviewService` depends on `ReportService`**, which has content-writing methods
   (owner-only). This softens the claim that the review class "has no dependency capable of
   writing content".
4. **`lib/format.ts` parses `yyyy-MM-dd` with `new Date()`**, which reads it as UTC — the trap
   `lib/week.ts` warns about. Dates show a day early only for viewers west of UTC.
5. **`WeeklyReportBackendApplicationTests` has no `@ActiveProfiles("test")`**, so `mvnw test`
   connects to the development database. `PLAN.md` says this was fixed, but the annotation is
   not there. Harmless in Jenkins, where the CI datasource overrides it.

---

## 2. AWS Free Tier findings (researched 19 Nov 2026)

The account was created in **September 2026**, so it is on the post-15-July-2025 Free Tier,
which is credit-based rather than "750 free hours":

- **$100 credits** at sign-up, plus up to **$100 more** for five activities: launch an EC2
  instance, create an RDS database, set a budget in AWS Budgets, build a Lambda web app, try
  the Bedrock playground.
- **Free plan:** ends 6 months after sign-up (≈ **March 2027**) or when the credits run out,
  whichever is first. The account is then suspended; there are 90 days to upgrade before it is
  deleted with all data. Some services are blocked on the Free plan.
- **Paid plan:** never closes; credits expire 12 months after sign-up; usage beyond the
  credits is billed to the card.
- **Every EC2 hour, disk, public IP and database is paid from the credits.** "Free tier
  eligible" instance types (t3.micro, t3.small, t4g.micro, t4g.small, c7i-flex.large,
  m7i-flex.large) only means the Free plan allows them.
- **Cost traps:** public IPv4 $0.005/hour each (≈ $3.60/month, even when idle as an Elastic
  IP); NAT gateway ≈ $32/month; load balancer ≈ $16/month. Neither of the last two is used.
- **RDS MySQL 8.0 is past standard support** and is billed Extended Support on top, so 8.4
  is used everywhere.
- **Jenkins' package repository moved** to `https://pkg.jenkins.io/rpm-stable/jenkins.repo`
  and now needs Java 21. The setup script uses the current address.

Sources: [AWS Free Tier](https://aws.amazon.com/free/),
[Free Tier FAQs](https://aws.amazon.com/free/free-tier-faqs/),
[Billing docs](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier.html),
[EC2 Free Tier usage](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html),
[Jenkins on Linux](https://www.jenkins.io/doc/book/installing/linux/).

---

## 3. Decisions

### Deployment shape — Option B was chosen

| Option | Shape | ≈ per month | Outcome |
|---|---|---|---|
| A | One EC2 running all three containers, MySQL included | $21 | Cheapest; considered |
| **B** | **EC2 for frontend + backend, RDS for MySQL** | **$35** (+ Jenkins) | **Chosen** — managed backups and patching, app server's RAM left to the app |
| C | ECS Fargate + load balancer + RDS | $65+ | Rejected — would use up the credits in about 3 months |

t3.micro (1 GB) was ruled out: MySQL plus a Spring Boot JVM does not fit.

### Other choices

| Question | Choice | Reason |
|---|---|---|
| Where Jenkins runs | **A second EC2** (t3.small) | Builds can run without the PC switched on. It cannot share the app server: Jenkins plus a Maven build needs ≈ 2 GB on its own. |
| Region | **ap-south-1 (Mumbai)** | Closest to the user |
| Health endpoint | **Add `/actuator/health`** | Lets Docker and the deploy tell a running app from a crashed one |
| Repository | **Public** on GitHub | Jenkins clones without a credential |
| Tests in the pipeline | **Yes** | Against a throwaway MySQL container |
| Branch name | `feature/docker-aws-deployment` | Matches the existing `feature/*` convention |

### Principles followed throughout

- **No AWS access keys anywhere.** Both servers use IAM instance roles: Jenkins may push to
  the two ECR repositories, the app server may only pull.
- **App secrets never pass through Jenkins.** They live in `/opt/weekly-report/app.env` on
  the app server, created once by hand. Jenkins holds exactly one secret: the SSH key.
- **Images are tagged with the commit id, never `latest`**, so a rollback is "deploy an
  earlier tag".
- **No key, password or `.pem` file was ever pasted into a chat, commit or build log.**

---

## 4. What was built

### Backend change — the health endpoint

| File | Change |
|---|---|
| `pom.xml` | Added `spring-boot-starter-actuator` |
| `application.properties` | Expose only `health`, with `show-details=never` |
| `SecurityConfig.java` | `GET /actuator/health` and `/actuator/health/**` are `permitAll` — nothing broader |
| `RoleBasedAccessControlTest.java` | New test: health is public and says only `UP`; `/actuator` and `/actuator/env` still return 401 |

The health check includes the database, so a backend that cannot reach RDS reports DOWN and
a broken deploy is rolled back. The endpoint is not reachable from the internet: the backend
port is bound to `127.0.0.1`, and nginx does not proxy `/actuator`.

### New files

| File | Purpose |
|---|---|
| `backend/weekly-report-backend/Dockerfile` | Maven build → layered jar → Alpine Java 21 runtime, non-root, health check |
| `backend/weekly-report-backend/.dockerignore` | Keeps `config/` (the local Gemini key) and `target/` out of the build |
| `frontend/Dockerfile` | Node 22 build (runs lint + `tsc -b`) → nginx |
| `frontend/nginx/default.conf.template` | SPA fallback, `/api` proxy, re-resolving Docker DNS, caching, security headers |
| `frontend/.dockerignore` | Keeps the Windows `node_modules` out (wrong native binaries) |
| `docker-compose.yml` | Local stack with MySQL 8.4 standing in for RDS — `http://localhost:8081` |
| `.env.example` | Optional overrides for the local stack |
| `deploy/docker-compose.prod.yml` | EC2 stack: two ECR images, RDS, memory limits, log rotation |
| `deploy/app.env.example` | Template for the server's secrets file |
| `deploy/deploy.sh` | On the app server: pull, restart, smoke test, automatic rollback |
| `deploy/setup/app-server.sh` | One-time app server setup: Docker, Compose plugin, swap |
| `deploy/setup/jenkins-server.sh` | One-time Jenkins server setup: Java 21, Jenkins LTS, Docker, Git, swap |
| `deploy/aws/jenkins-ecr-push-policy.json` | IAM: push to the two repositories only |
| `deploy/aws/ecr-lifecycle-policy.json` | Keep the newest 10 images per repository |
| `ci/backend-tests.sh` | Backend tests against a throwaway MySQL, entirely in containers |
| `Jenkinsfile` | Prepare → tests → build → push to ECR → deploy over SSH |
| `.gitattributes` | Keeps scripts, Dockerfiles, YAML and the template LF on Windows checkouts |
| `docs/DEPLOYMENT.md` | Architecture, costs, AWS setup steps, operations, troubleshooting |
| `docs/DOCUMENTATION.md` | This file |

Also updated: `.gitignore` (`.env`, `ci-reports/`), `README.md` (docs table entry and the
`docker compose` quick start), `docs/PLAN.md` (deployment checklist), `CLAUDE.md`
(deployment rules for future sessions).

### How it fits together

```
 GitHub ──► Jenkins EC2 ──► tests (MySQL container) ──► docker build ──► ECR (ap-south-1)
                 │                                                          │
                 └── ssh: copy compose file + deploy.sh, run it ──► App EC2 ◄┘ docker pull
                                                                       │
                                        nginx :80 ──/api──► Spring Boot :8080 ──► RDS MySQL 8.4
```

### Design details worth being able to explain

- **nginx forwards `/api` to the backend**, so the browser talks to one address. The React
  build keeps using relative `/api` paths, with no API URL baked in and no CORS
  configuration — the same arrangement Vite's dev proxy gives locally.
- **nginx re-resolves the backend's address every 10 seconds** (`resolver 127.0.0.11` plus a
  variable in `proxy_pass`). A deploy replaces the backend container, which comes back on a
  new IP; without this, nginx would answer 502 until it was restarted too.
- **Two env files on the server.** `release.env` says *which* images run and is rewritten on
  every deploy; `app.env` says *how* the app runs and is never touched by a deploy.
- **`deploy.sh` pulls before it switches.** The new release is written to `release.env.next`
  and pulled first; only then does `release.env` change. A failed pull leaves the running
  release untouched.
- **`deploy.sh` is copied to the server and run there**, not streamed with
  `ssh … bash -s < deploy.sh`: when a script arrives on stdin, any command inside it that
  reads stdin swallows the rest of the script.
- **Automatic rollback.** If the backend never turns healthy, or the smoke test fails
  (`GET /` must be 200, `POST /api/auth/login` with `{}` must be 400), the previous
  `release.env` is restored and the job fails. Any earlier release can be redeployed with the
  `DEPLOY_EXISTING_TAG` parameter.
- **Tests need only Docker on the build server.** `ci/backend-tests.sh` runs MySQL 8.4 and
  Maven in containers on a private network. `SPRING_DATASOURCE_*` environment variables
  outrank `application-test.properties`, which points the tests at that container. Sources
  are mounted read-only and copied inside, so no root-owned files land in the workspace.
- **Jenkins is installed directly on its server, not in a container**, because the pipeline
  mounts workspace paths into the containers it starts, and those paths must mean the same
  thing to Jenkins and to the Docker daemon.

---

## 5. Image optimisation

The first working backend image was 163 MB compressed. Three changes followed:

| Change | Effect |
|---|---|
| `eclipse-temurin:21-jre-alpine` instead of the Ubuntu-based JRE | ≈ 150 MB smaller unpacked. musl vs glibc only matters to native code, and this app has none. |
| Spring Boot layered jar (`java -Djarmode=tools … extract --layers`) | Dependencies (≈ 64 MB) and our own classes (≈ 250 KB) become separate layers. A code-only deploy pushes and pulls ≈ 250 KB instead of the whole jar, and ECR stores the dependencies once. |
| Removed `apt-get install curl`; the health check uses busybox `wget` | One less package step per build |

| Backend image | Before | After |
|---|---|---|
| Docker Desktop "disk usage" | 578 MB | **408 MB** |
| Compressed (stored in ECR, downloaded by EC2) | 163 MB | **124 MB** |
| Transferred on a code-only deploy | 64 MB (the whole jar) | **≈ 250 KB** |

The frontend image is 74 MB on disk and **21 MB compressed**; the app itself is 0.5 MB, the
rest is nginx on Alpine. It was left as it is.

**Stopped there on purpose.** A jlink custom runtime or distroless images would each save
only another 20–30 MB. They would make the Dockerfile harder to explain, and distroless
leaves no shell for `docker exec` debugging on EC2.

Note on reading sizes: Docker Desktop's "disk usage" counts an image both compressed and
unpacked, so it looks inflated. "Content size", or `docker save | gzip`, is what ECR stores
and EC2 downloads.

---

## 6. Verification

### Backend test suite

`mvnw test` against the local test schema: **228 tests, 0 failures, 0 errors**, including the
new health-endpoint test.

### Static checks

- `bash -n` on all four shell scripts.
- `docker compose config` on both compose files, with sample values for the production one.
- Both IAM/ECR JSON policies parse.

### Local container run (Docker Desktop)

`docker compose up --build`, then again from a wiped database (`down -v`) after the
optimisation:

| Check | Result |
|---|---|
| Both images build (frontend lint + `tsc -b` inside the build) | ✔ |
| MySQL healthy → backend healthy → nginx started, in dependency order | ✔ |
| First boot: 4 Flyway migrations applied, demo data loaded (6 users, 21 reports) | ✔ |
| `GET /` → 200; deep link `/reports/12` → 200 (SPA fallback) | ✔ |
| `POST /api/auth/login {}` through nginx → 400 (the `deploy.sh` smoke test) | ✔ |
| Demo login (`maya.sharma@example.com`) → token; dashboard summary returns real data | ✔ |
| `/actuator/health` → `UP` on the backend; through nginx it returns the SPA page, not the endpoint | ✔ |
| Security headers present (`X-Frame-Options`, `X-Content-Type-Options`) | ✔ |
| Backend container recreated onto a new IP, nginx **not** restarted → API still answers | ✔ |
| Backend runs as non-root (`uid=100(app)`); timezone IST (+05:30) | ✔ |
| Memory: backend ≈ 370–390 MB, frontend ≈ 15 MB (limits 1 GB / 128 MB) | ✔ |

Docker Desktop and the Docker engine inside WSL are separate: each keeps its own images and
containers. Everything above ran on Docker Desktop, so it does not appear in `docker ps`
inside WSL, and the existing minikube and Kafka containers there were not touched.

---

## 7. What is left

1. **Review and commit** the branch (nothing is committed yet), then push.
2. **Create the AWS resources**, following [`DEPLOYMENT.md`](DEPLOYMENT.md) Part 2 from Step 0
   (budgets): ECR, IAM roles, security groups, RDS, both EC2 servers, Jenkins.
3. **First pipeline run**, then open `http://<app-public-ip>`.
4. **Watch the credits.** Everything running 24/7 is ≈ $56/month, which the credits cannot
   sustain until March 2027. Stopping the Jenkins server between builds brings it to ≈ $38.
5. Optional, later: HTTPS (a domain plus Let's Encrypt, or a load balancer with an ACM
   certificate), `sslMode=VERIFY_CA` for RDS, and the five review notes in section 1.

### Useful commands

```bash
# Local stack
docker compose up --build        # build and start — http://localhost:8081
docker compose down              # stop, keep the database
docker compose down -v           # stop and delete the local database

# Backend tests (local MySQL on 3306)
cd backend/weekly-report-backend && ./mvnw test

# On the app server, once deployed
cd /opt/weekly-report
docker compose --env-file release.env ps
docker logs -f weekly-report-backend
cat release.env                  # which tag is running
```
