# Deploy Proofly to AWS

The repository supplies the application, two Docker build targets, database migrations, a private S3 CloudFormation template, a production Compose file, Nginx configuration, and GitHub Actions. Actual deployment requires an AWS account, a server, a domain, a database, and the configuration below. No AWS resources are created by a code push.

## 1. Private image storage

Create a CloudFormation stack from `infra/s3.yaml`, supplying a globally unique bucket name and your exact application origin, such as `https://proofly.example.com`. Acknowledge creation of IAM resources. The stack retains the bucket if deleted and creates an EC2 instance profile that grants only object reads/writes under the staging and workspace prefixes.

The bucket blocks public access, disables ACLs, encrypts objects, enables versioning, requires HTTPS, and expires staging uploads after one day. CORS permits your application origin and the configured local-development origin. Remove the local origin if development no longer needs it. Keep the bucket private; no public-read policy is needed.

Attach the returned instance profile to the application EC2 instance. Require IMDSv2 and set the response hop limit to 2 so the AWS SDK inside Docker can retrieve role credentials. Omit static AWS access keys from the production environment. For local development only, a scoped IAM identity may supply access keys through `.env.local` or the local shell.

## 2. Database and server

Use PostgreSQL 16 or newer, such as a private Amazon RDS instance in the same VPC. Allow its port 5432 only from the application instance’s security group. Enable backups and use a dedicated application database/user. The application user must be able to run the supplied migrations.

Install Docker Engine with the Compose plugin, Nginx, curl, and a TLS certificate on an Ubuntu EC2 instance. Open HTTPS/HTTP as needed and restrict SSH to the deployment path you control. Application port 3000 and database port 5432 should not be exposed publicly. The supplied Compose configuration binds the application to loopback only.

Create the application directory for your deployment user:

```sh
sudo mkdir -p /opt/proofly/scripts /opt/proofly/certs
sudo chown -R "$USER":"$USER" /opt/proofly
```

Download the current Amazon RDS CA bundle into `/opt/proofly/certs/rds-ca.pem` from the [Amazon RDS trust store](https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem). Both production containers mount this directory read-only. Verify the RDS hostname against this certificate bundle.

Create `/opt/proofly/.env.production` on the server, never in Git:

```dotenv
APP_URL=https://proofly.example.com
DATABASE_URL=postgresql://APP_USER:URL_ENCODED_PASSWORD@RDS_HOST:5432/proofly?sslmode=verify-full&sslrootcert=/run/certs/rds-ca.pem
AWS_REGION=ap-south-1
S3_BUCKET=your-private-proofly-bucket
TRUST_PROXY=true
```

Use the actual region of your bucket. Protect the environment file with `chmod 600 /opt/proofly/.env.production`. Database passwords must be URL-encoded in the connection string. Production HTTPS origins receive Secure session cookies; the HTTP localhost exception exists only for local Docker development.

## 3. Nginx and HTTPS

Replace `proofly.example.com` and certificate paths in `infra/nginx.conf`. Copy `infra/proofly-proxy.conf` to `/etc/nginx/snippets/proofly-proxy.conf`, then install the server configuration and run `sudo nginx -t` before reloading Nginx. The supplied server file requires a recent Nginx with the `http2 on` directive; older packaged versions can use `listen 443 ssl http2` and omit that directive.

The proxy overwrites forwarding headers and does not log review/invitation URL paths. If Cloudflare or another proxy is placed in front, configure Nginx’s trusted real-IP ranges explicitly before relying on per-client limits. Keep port 3000 bound to loopback.

## 4. GitHub Actions

The `Build and deploy` workflow runs on pushes to `main`. It first calls `Continuous integration`, which checks lint, types, unit tests, PostgreSQL integration tests, a production build, and production dependency vulnerabilities. Only successful verification publishes two immutable images:

```text
ghcr.io/utpalsonowal7/proofly:COMMIT_SHA
ghcr.io/utpalsonowal7/proofly-migrate:COMMIT_SHA
```

The repository’s built-in token publishes packages; no registry secret is needed in GitHub. On the EC2 server, either authenticate Docker to GHCR with a read-packages token or make both published packages public. A public source repository does not automatically make its packages public.

To enable deployment, add the repository variable `DEPLOY_ENABLED=true` and these secrets in the repository or its `production` environment:

| Name                 | Value                                                              |
| -------------------- | ------------------------------------------------------------------ |
| `DEPLOY_HOST`        | EC2 hostname or stable address                                     |
| `DEPLOY_USER`        | Deployment user with Docker access and ownership of `/opt/proofly` |
| `DEPLOY_SSH_KEY`     | Private key for a dedicated deployment identity                    |
| `DEPLOY_KNOWN_HOSTS` | Verified SSH host-key entry for that hostname                      |

Verify the host fingerprint through a trusted channel before saving it. The workflow enforces strict host-key checking, copies deployment files, and invokes the deployment script. It does not transfer application secrets. Without `DEPLOY_ENABLED=true`, verification and image publication still run, while EC2 deployment stays disabled.

## 5. First deployment and later releases

The pipeline transfers `compose.production.yaml` and `scripts/deploy.sh`. For a manual first deployment, copy those two files to their matching locations under `/opt/proofly`, then run:

```sh
bash /opt/proofly/scripts/deploy.sh \
  ghcr.io/utpalsonowal7/proofly:COMMIT_SHA \
  ghcr.io/utpalsonowal7/proofly-migrate:COMMIT_SHA
```

The script pulls both images, runs forward migrations before restarting the application, and checks readiness. A failed migration leaves the prior application running. A failed application readiness check restores the prior image when one exists, or stops the unsuccessful first release. Release deployment briefly restarts one application container; it is not a zero-downtime rollout.

Database migrations are not automatically reversed. Keep changes compatible with the previous application during rollout and backup the database before destructive schema changes. Add a new numbered migration instead of editing an applied one; migration checksums are verified under an advisory lock.

Health checks:

```sh
curl -i https://proofly.example.com/api/health/live
curl -i https://proofly.example.com/api/health
curl -I https://proofly.example.com/api/health
```

`/api/health/live` checks the process. `/api/health` checks database connectivity and required S3 configuration; it does not perform an AWS permissions probe. GET and HEAD are supported. Verify a real image upload, authenticated preview, version replacement, and guest review after initial configuration.

## 6. Maintenance and rollback

Run cleanup daily through your server’s scheduler:

```sh
cd /opt/proofly
docker compose --env-file .release.env -f compose.production.yaml run --rm migrate node scripts/maintenance.mjs
```

S3 independently expires staging objects. Cleanup removes expired sessions and stale counters, old invitations/review links, and abandoned database upload reservations. It does not delete finalized designs or feedback.

To roll back to the previous application after a successful deployment:

```sh
cd /opt/proofly
cp .previous-release.env .rollback.env
docker compose --env-file .rollback.env -f compose.production.yaml up -d --no-deps app
curl --fail http://127.0.0.1:3000/api/health
cp .rollback.env .release.env
```

This restores application code only. Retain database backups and previous container images independently.
