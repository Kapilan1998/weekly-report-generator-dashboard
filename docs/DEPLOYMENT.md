# Deployment — Docker, Jenkins and AWS

How the application is containerised, built by Jenkins, pushed to Amazon ECR and run on EC2
against an RDS MySQL database. Region throughout: **`ap-south-1` (Mumbai)**.

Part 1 explains the design. Part 2 is the step-by-step setup, in the order it has to be done.
Part 3 is day-to-day operation.

---

## Part 1 — The design

### What runs where

```
 You (browser) ──── http://<app-public-ip> ────────────────┐
                                                           ▼
 ┌──────────── App EC2  (t3.small, Amazon Linux 2023) ───────────────┐
 │  docker compose                                                   │
 │   ┌─────────────────────┐  /api/*   ┌──────────────────────────┐  │
 │   │ frontend  :80       │ ────────► │ backend  :8080           │  │      ┌──────────────────┐
 │   │ nginx + React build │           │ Spring Boot (Java 21)    │ ─┼────► │ RDS MySQL 8.4    │
 │   └─────────────────────┘           └──────────────────────────┘  │ 3306 │ db.t4g.micro     │
 │   app.env (secrets, created once by hand)                         │      │ private, no      │
 └───────────────────────────────────────────────────────────────────┘      │ public access    │
            ▲ ssh (private IP): copy compose file, run deploy.sh             └──────────────────┘
            │                       ▲ docker pull (instance role: read-only)
 ┌──────── Jenkins EC2  (t3.small) ─┼───────────────┐
 │ Jenkins LTS + Docker + Git        │               │      ┌───────────────────────────┐
 │ tests ─► build images ─► push ────┼──────────────────────►│ ECR (ap-south-1)          │
 │ (instance role: push to ECR only) │               │      │  weekly-report-backend    │
 └───────────────────────────────────┘               │      │  weekly-report-frontend   │
    ▲ http://<jenkins-ip>:8080 (your IP only)        │      └───────────────────────────┘
    You
```

- **Two images**, both built from this repository:
  - `weekly-report-backend` — the Spring Boot jar on a Java 21 runtime.
  - `weekly-report-frontend` — the Vite build served by nginx. nginx also forwards `/api/*`
    to the backend, so the browser talks to a single address and the backend needs no CORS
    configuration — the same arrangement `npm run dev` gives you with Vite's proxy.
- **The database is RDS**, not a container. AWS takes the backups and applies the patches,
  and the app server's 2 GB is left to the application.
- **Flyway still owns the schema.** The backend migrates RDS on start-up exactly as it does
  locally. On the very first boot against an empty database, the demo data loader fills it
  (six accounts, password `Demo@1234`).

### Repository files

| File | What it is |
|---|---|
| `backend/weekly-report-backend/Dockerfile` | Two-stage build: Maven + JDK builds the jar, a JRE image runs it as a non-root user |
| `frontend/Dockerfile` | Two-stage build: Node builds (and lints, and typechecks), nginx serves |
| `frontend/nginx/default.conf.template` | SPA fallback, `/api` proxy, caching, security headers |
| `docker-compose.yml` | Run everything locally, with a MySQL container standing in for RDS |
| `deploy/docker-compose.prod.yml` | The production stack on the app server: two ECR images, no database |
| `deploy/deploy.sh` | Runs on the app server: pull, restart, smoke test, roll back on failure |
| `deploy/app.env.example` | Template for the app server's secrets file |
| `deploy/setup/app-server.sh` | One-time app server setup: Docker, Compose, swap |
| `deploy/setup/jenkins-server.sh` | One-time Jenkins server setup: Java 21, Jenkins, Docker, Git, swap |
| `deploy/aws/jenkins-ecr-push-policy.json` | IAM policy: push to the two repositories and nothing else |
| `deploy/aws/ecr-lifecycle-policy.json` | Keep the newest 10 images per repository |
| `ci/backend-tests.sh` | Runs the backend tests against a throwaway MySQL container |
| `Jenkinsfile` | The pipeline |

### The pipeline

```
Prepare ─► Backend tests ─► Build images ─► Push to ECR ─► Deploy to EC2
```

| Stage | What happens |
|---|---|
| Prepare | Image tag = the 12-character commit id. The AWS account id is looked up from the instance role, so nothing account-specific is in the repository. |
| Backend tests | `ci/backend-tests.sh` starts MySQL 8.4 in a container and runs `mvn test` in another, on a private Docker network. Results appear on the build page. |
| Build images | `docker build` for both. The frontend build runs the linter and `tsc -b`, so a lint warning fails the pipeline. |
| Push to ECR | Logs in with the instance role and pushes both images. |
| Deploy to EC2 | Copies the compose file and `deploy.sh` to the app server over SSH and runs it. |

Decisions worth being able to explain:

- **Tagged by commit, never `latest`.** The tag says exactly which code is running, and a
  rollback is "deploy the previous tag" — not "hope nobody overwrote latest".
- **No AWS keys anywhere.** Both servers get their AWS permissions from IAM *instance
  roles*: Jenkins may push to the two repositories, the app server may only pull. There are
  no access keys to leak, rotate or paste into Jenkins.
- **Secrets never pass through Jenkins.** The database password, JWT secret and Gemini key
  live in `/opt/weekly-report/app.env` on the app server, created once by hand. Jenkins
  holds exactly one secret: the SSH key it uses to reach that server.
- **Two env files on the server, for two jobs.** `release.env` says *which* images to run
  and is rewritten on every deploy. `app.env` says *how* the app runs and is never touched
  by a deploy.
- **Automatic rollback.** `deploy.sh` keeps the previous `release.env`. If the new backend
  never becomes healthy, or the smoke test fails, it switches back and the job fails.
- **The health check includes the database.** `/actuator/health` reports DOWN when the
  backend cannot reach RDS, so a deploy that broke the database connection is rolled back
  instead of being declared healthy. It is reachable only from inside the server: the backend
  port is bound to `127.0.0.1`, and nginx does not proxy `/actuator`.
- **Tests need Docker on the build server and nothing else.** No JDK, Maven or MySQL is
  installed on the Jenkins server; the build tools come in images.

### Cost

Approximate on-demand prices for `ap-south-1`, if everything runs 24/7. Check them in the
[AWS Pricing Calculator](https://calculator.aws/) before you rely on them.

| Resource | ≈ per month |
|---|---|
| App EC2 t3.small | $15 |
| Jenkins EC2 t3.small | $15 |
| RDS db.t4g.micro + 20 GB storage | $14 |
| 2 public IPv4 addresses ($0.005/hour each) | $7.30 |
| EBS disks (20 GB app + 30 GB Jenkins, gp3) | $4 |
| ECR storage (≈1 GB) | $0.10 |
| **Total** | **≈ $56** |

On the Free plan that is more than your credits can sustain for the months remaining.
**Stop the Jenkins server whenever you are not building**: a stopped instance costs nothing
for compute or for its public IP, only for its disk (about $2.40). That brings the total to
roughly $38 a month. Stop everything when you are not demoing — see
[Saving credits](#saving-credits).

Never create a **NAT gateway** (≈ $32/month) or a **load balancer** (≈ $16/month). Nothing
here needs either.

---

## Part 2 — Setup, step by step

Do these in order — later steps refer to things earlier ones create. Unless a step says
otherwise, everything is in the AWS console with the region selector (top right) set to
**Asia Pacific (Mumbai) ap-south-1**.

**Never paste a key, password or `.pem` file into a chat, a commit or a Jenkins build log.**

### Step 0 — Cost guardrails (do this first)

1. **Billing and Cost Management → Budgets → Create budget**
   - **Zero spend budget**: emails you the moment anything costs money beyond your credits.
   - **Monthly cost budget**: $25, with an alert at 80%.
2. Budgets → **Billing preferences**: confirm the alert email address is one you read.
3. **Billing → Credits**: note your remaining balance and its expiry date.

Creating a budget is also one of the activities that earns extra Free Tier credits.

### Step 1 — ECR repositories

**ECR → Private registry → Repositories → Create repository**, twice:

| Setting | Value |
|---|---|
| Repository name | `weekly-report-backend`, then `weekly-report-frontend` |
| Image tag mutability | Mutable |
| Scan on push | On (free, basic scanning) |

Then, for each repository: **Lifecycle policy → Create rule** →
"Image count more than **10**", tag status **Any**, action **Expire**.
(`deploy/aws/ecr-lifecycle-policy.json` is the same rule as JSON.)

### Step 2 — IAM roles for the two servers

**IAM → Policies → Create policy → JSON**: paste `deploy/aws/jenkins-ecr-push-policy.json`.
Name it `WeeklyReportJenkinsEcrPush`.

**IAM → Roles → Create role → Trusted entity: AWS service → Use case: EC2**, twice:

| Role name | Permissions policy | Used by |
|---|---|---|
| `weekly-report-jenkins-role` | `WeeklyReportJenkinsEcrPush` | Jenkins server |
| `weekly-report-app-role` | `AmazonEC2ContainerRegistryReadOnly` (AWS managed) | App server |

The Jenkins role can push to exactly two repositories. The app role can pull and nothing
more — a compromised app server cannot overwrite images.

### Step 3 — Security groups

**EC2 → Security Groups → Create security group**, in the default VPC. Create them in this
order, because the later ones refer to the earlier ones.

| Name | Inbound rules |
|---|---|
| `weekly-report-jenkins-sg` | TCP **8080** from **My IP** · TCP **22** from **My IP** |
| `weekly-report-app-sg` | TCP **80** from **Anywhere-IPv4** · TCP **22** from **My IP** · TCP **22** from `weekly-report-jenkins-sg` |
| `weekly-report-rds-sg` | TCP **3306** from `weekly-report-app-sg` |

Leave outbound as the default (all traffic). The database accepts connections from the app
server's security group and nothing else — not from the internet, not from Jenkins, not
from your PC.

"My IP" is your current address. If your ISP changes it, update these two rules, or you are
locked out of SSH and the Jenkins UI.

### Step 4 — RDS MySQL

**RDS → Create database**:

| Setting | Value | Why |
|---|---|---|
| Creation method | Standard create | |
| Engine | MySQL, version **8.4.x** | 8.0 is past standard support and RDS bills "Extended Support" on top for it. Matches the MySQL used locally and in CI. |
| Template | Free tier (or Dev/Test) | |
| Deployment | Single-AZ | Multi-AZ doubles the price |
| DB instance identifier | `weekly-report-db` | |
| Master username | `admin` | |
| Credentials management | Self managed — set a strong password and keep it | Goes into `app.env` in step 6 |
| Instance class | **db.t4g.micro** | |
| Storage | gp3, **20 GB**, storage autoscaling **off** | |
| Compute resource | Don't connect to an EC2 compute resource | The security groups from step 3 do it |
| Public access | **No** | |
| VPC security group | Choose existing → `weekly-report-rds-sg` (remove `default`) | |
| Additional configuration → Initial database name | `weekly_report_dashboard` | |
| Backup retention | 1 day | |
| Performance Insights, Enhanced monitoring | Off | Extra cost |
| Deletion protection | On | A misclick can't wipe it |

Creation takes about 10 minutes. Then copy the **Endpoint** from
*Connectivity & security* — it looks like
`weekly-report-db.xxxxxxxxxxxx.ap-south-1.rds.amazonaws.com`.

### Step 5 — App server (EC2)

**EC2 → Launch instance**:

| Setting | Value |
|---|---|
| Name | `weekly-report-app` |
| AMI | **Amazon Linux 2023** (64-bit **x86**) |
| Instance type | **t3.small** |
| Key pair | Create new → `weekly-report-key`, RSA, `.pem`. **Download and keep it safe** — you cannot download it again. |
| Network settings → Security group | Select existing → `weekly-report-app-sg` |
| Storage | **20 GB gp3** |
| Advanced details → IAM instance profile | `weekly-report-app-role` |

x86, not Graviton (t4g): Jenkins builds x86 images. Graviton would need multi-architecture
builds.

Once it is running, note **both** addresses from the instance page:
- **Public IPv4** — where you open the app in a browser.
- **Private IPv4** — what Jenkins uses to reach it. It stays the same across stop/start;
  the public one does not.

Connect from PowerShell on your PC and run the setup script:

```powershell
# Windows: OpenSSH refuses a key file others can read. Restrict it to you first:
icacls .\weekly-report-key.pem /inheritance:r /grant:r "$($env:USERNAME):(R)"

scp -i .\weekly-report-key.pem deploy\setup\app-server.sh ec2-user@<APP_PUBLIC_IP>:~
ssh -i .\weekly-report-key.pem ec2-user@<APP_PUBLIC_IP>
```

On the server:

```bash
bash app-server.sh
exit                                   # log out and back in, so the docker group applies
```

Reconnect, then check:

```bash
docker compose version                 # prints a version
aws sts get-caller-identity            # shows ...assumed-role/weekly-report-app-role/...
```

### Step 6 — The app's secrets (`app.env`)

Still on the app server:

```bash
openssl rand -base64 48                # copy the output - this is your JWT secret
nano /opt/weekly-report/app.env
```

Paste the contents of `deploy/app.env.example` and fill in:

- `DB_URL` — replace the host with your RDS endpoint from step 4. Keep the rest of the line.
- `DB_USERNAME` / `DB_PASSWORD` — the RDS master user and password.
- `JWT_SECRET` — the value you just generated.
- `GEMINI_API_KEY` — optional. Leave it empty to run without the assistant.

Save (Ctrl+O, Enter, Ctrl+X), then make it readable by you alone:

```bash
chmod 600 /opt/weekly-report/app.env
```

### Step 7 — Jenkins server (EC2)

**EC2 → Launch instance**:

| Setting | Value |
|---|---|
| Name | `weekly-report-jenkins` |
| AMI | **Amazon Linux 2023** (64-bit x86) |
| Instance type | **t3.small** |
| Key pair | `weekly-report-key` (the same one) |
| Security group | `weekly-report-jenkins-sg` |
| Storage | **30 GB gp3** — Docker images and the Maven cache add up |
| IAM instance profile | `weekly-report-jenkins-role` |

Install Jenkins:

```powershell
scp -i .\weekly-report-key.pem deploy\setup\jenkins-server.sh ec2-user@<JENKINS_PUBLIC_IP>:~
ssh -i .\weekly-report-key.pem ec2-user@<JENKINS_PUBLIC_IP>
```

```bash
bash jenkins-server.sh                 # prints the initial admin password at the end
sudo -u jenkins aws sts get-caller-identity    # shows ...weekly-report-jenkins-role...
sudo -u jenkins docker ps                      # an empty table, not "permission denied"
```

Open `http://<JENKINS_PUBLIC_IP>:8080` in your browser:

1. Paste the initial admin password.
2. **Install suggested plugins**.
3. Create your admin user.
4. **Manage Jenkins → Plugins → Installed**: confirm **Pipeline**, **Git**,
   **Credentials Binding**, **JUnit** and **Timestamper** are there. Install any that are
   missing from *Available plugins*.

### Step 8 — Configure Jenkins

**The SSH key, so Jenkins can reach the app server.**
Manage Jenkins → Credentials → System → Global credentials → **Add Credentials**:

| Field | Value |
|---|---|
| Kind | SSH Username with private key |
| ID | **`app-ec2-ssh`** (the Jenkinsfile refers to it by this exact id) |
| Username | `ec2-user` |
| Private Key | Enter directly → paste the whole contents of `weekly-report-key.pem` |

**Where the app server is.**
Manage Jenkins → System → **Global properties** → tick *Environment variables* → Add:

| Name | Value |
|---|---|
| `APP_EC2_HOST` | the app server's **private** IPv4 from step 5 |

The private address, because it never changes and the traffic stays inside AWS.

**The pipeline job.**
Dashboard → **New Item** → name `weekly-report` → **Pipeline** → OK. Under *Pipeline*:

| Field | Value |
|---|---|
| Definition | Pipeline script from SCM |
| SCM | Git |
| Repository URL | `https://github.com/Kapilan1998/weekly-report-generator-dashboard.git` |
| Credentials | none (the repository is public) |
| Branch Specifier | `*/main` — or `*/feature/docker-aws-deployment` to try it before merging |
| Script Path | `Jenkinsfile` |

Save.

### Step 9 — First deploy

Click **Build Now**.

- The very first build runs with the default parameters. That is also how Jenkins learns the
  parameters, so from the second build the button reads **Build with Parameters**.
- Expect 10–15 minutes the first time: every base image and Maven dependency is downloaded.
  Later builds reuse them and take a few minutes.
- The first start of the backend against the empty RDS database runs every Flyway migration
  and loads the demo data, so it takes longer than later starts.

Then open **`http://<APP_PUBLIC_IP>`** and sign in as `maya.sharma@example.com` / `Demo@1234`.

---

## Part 3 — Operating it

### Deploying a change

Push to the branch the job builds, then **Build with Parameters → Build** in Jenkins.

To have pushes deploy automatically instead, see [Automatic builds](#automatic-builds-optional).

### Rolling back

- **Automatic:** if a deploy is unhealthy, `deploy.sh` has already restored the previous
  release before the job reports failure.
- **To any earlier version:** *Build with Parameters* → set **`DEPLOY_EXISTING_TAG`** to an
  earlier tag. That tag is a 12-character commit id; you can see it in the build history
  descriptions, or under ECR → repository → Images. Tests, build and push are skipped, and
  that image is deployed.
- **By hand, on the app server:**

  ```bash
  cd /opt/weekly-report
  cp release.env.previous release.env
  docker compose --env-file release.env up -d
  ```

### Logs and status (on the app server)

```bash
cd /opt/weekly-report
docker compose --env-file release.env ps            # containers and their health
docker logs -f weekly-report-backend                 # Spring Boot log
docker logs -f weekly-report-frontend                # nginx access log
curl -s localhost:8080/actuator/health               # {"status":"UP"}
cat release.env                                      # which tag is running
```

### Changing a secret

Edit `/opt/weekly-report/app.env`, then recreate the backend so it reads the file again:

```bash
cd /opt/weekly-report && docker compose --env-file release.env up -d --force-recreate backend
```

Changing `JWT_SECRET` signs everyone out.

### Reloading the demo data

The loader runs only when the `users` table is empty, and RDS is not public. Easiest: delete
the RDS instance and create it again (step 4), then redeploy. Alternatively, from the app
server, drop and recreate the database with a temporary MySQL client container:

```bash
docker run --rm -it mysql:8.4 mysql -h <RDS_ENDPOINT> -u admin -p \
  -e "DROP DATABASE weekly_report_dashboard; CREATE DATABASE weekly_report_dashboard;"
cd /opt/weekly-report && docker compose --env-file release.env restart backend
```

### Saving credits

| Action | Effect |
|---|---|
| **EC2 → Instance state → Stop** the Jenkins server between builds | Saves ≈ $18/month. Its public IP changes on each start, so update the Jenkins URL you use. |
| Stop the app server when not demoing | Its public IP changes too. Jenkins is unaffected, because it uses the private one. |
| RDS → Actions → **Stop temporarily** | Saves the instance cost. **RDS starts itself again after 7 days**, so stop it again. |
| Elastic IP | Gives the app a fixed address, but is billed even while the instance is stopped. Skip it unless you need a stable URL. |

Containers come back on their own when the app server starts again (`restart:
unless-stopped`).

### Tearing it all down

Do this when you are finished, or before the Free plan ends — otherwise everything stops
anyway, and the data is deleted 90 days later.

1. RDS: turn off deletion protection (Modify), then delete. Take a final snapshot only if
   you want to keep the data — snapshots are billed too.
2. EC2: terminate both instances. Then check **Volumes** — none should be left — and
   **Elastic IPs**: release any.
3. ECR: delete both repositories.
4. Security groups, IAM roles and the IAM policy cost nothing, but delete them for tidiness.
5. A day later, check **Billing → Bills** shows nothing still running.

### Automatic builds (optional)

Only worth it if the Jenkins server stays running, since its public address changes on
every start.

1. In the job: *Build Triggers* → tick **GitHub hook trigger for GITScm polling**.
2. GitHub repository → Settings → Webhooks → Add webhook:
   payload URL `http://<JENKINS_PUBLIC_IP>:8080/github-webhook/`, content type
   `application/json`, *Just the push event*.
3. Allow GitHub through `weekly-report-jenkins-sg`: TCP 8080 from the `hooks` ranges listed
   at <https://api.github.com/meta>.

### Running the containers locally

The same images, with MySQL in a container instead of RDS (Docker Desktop must be running):

```bash
docker compose up --build        # first build: several minutes
```

Open **http://localhost:8081**. The demo data loads on the first start. Stop with
`docker compose down`; add `-v` to delete the database as well. Values can be overridden
in a `.env` file — see `.env.example`.

---

## Security notes and known limits

- **Plain HTTP.** The app is served over HTTP on the server's address, so sign-in requests
  travel unencrypted. Fine for a demo with seeded accounts; not for real users. The fix is a
  domain name plus a certificate: either Let's Encrypt (certbot) on the nginx container, or
  an Application Load Balancer with an ACM certificate (≈ $16/month).
- **The RDS connection is encrypted but the certificate is not verified**
  (`sslMode=REQUIRED`). `VERIFY_CA` needs the RDS CA bundle in the backend's truststore.
  Exposure is low, since the connection never leaves the VPC.
- **SSH and the Jenkins UI are limited to your IP** by security groups. Jenkins can run
  Docker, which is root-equivalent on its server — that is why it gets a dedicated server
  rather than sharing the app's.
- **One app server, no redundancy.** If it stops, the site is down until it is started
  again. ECS or an Auto Scaling group behind a load balancer would fix that, at several times
  the cost.
- **Jenkins builds on its built-in node.** Normal for a single-server setup. A larger team
  would add separate build agents.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Prepare fails: *Unable to locate credentials* | The Jenkins server has no IAM role. EC2 → instance → Actions → Security → **Modify IAM role** → `weekly-report-jenkins-role`. |
| *permission denied … /var/run/docker.sock* | The jenkins user is not in the docker group yet. Re-run `jenkins-server.sh`, which restarts Jenkins. |
| Deploy: *Permission denied (publickey)* | The `app-ec2-ssh` credential has the wrong key or username (must be `ec2-user`). |
| Deploy: SSH times out | `weekly-report-app-sg` lacks *TCP 22 from `weekly-report-jenkins-sg`*, or `APP_EC2_HOST` is the public IP rather than the private one. |
| Deploy: *app.env is missing* | Step 6 was skipped. |
| Pull fails: *no basic auth credentials* / *denied* | The app server has no IAM role (`weekly-report-app-role`). |
| Backend never healthy, log says *Communications link failure* | The backend can't reach RDS: check `weekly-report-rds-sg` allows 3306 from `weekly-report-app-sg`, and the endpoint in `DB_URL`. |
| Backend log says *Access denied for user* | The wrong `DB_USERNAME` / `DB_PASSWORD` in `app.env`. |
| Browser shows **502 Bad Gateway** | nginx is up but the backend is not. `docker logs weekly-report-backend`. |
| A build dies with *exit code 137* | Out of memory. Check swap is on (`swapon --show`). |
| A script fails with `$'\r': command not found` | It has Windows line endings. `.gitattributes` prevents this for files from Git; for a file copied by hand, run `sed -i 's/\r$//' file.sh`. |
| The site worked, then stopped answering after a restart | The public IP changed. Use the new one from the EC2 console. |
