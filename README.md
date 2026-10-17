# Proofly

**Good work. On the same page.**

A creative review workspace for freelancers, studios, and their clients. Give projects a home, pin feedback exactly where it belongs, compare revisions, and approve the right version.

Built with **Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, and Amazon S3**. The frontend and backend run in one application. **S3 is the only uploaded-file storage provider.**

## Take a little look

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000) for the landing page or [localhost:3000/demo](http://localhost:3000/demo) for the interactive workspace. The demo includes six sample projects, pinned conversations, and a pair of design revisions to compare. No AWS account or database is needed for the demo.

Demo text changes stay in your browser. Demo uploads are temporary previews in the current tab; create an account and configure S3 to save actual files.

## What you can do

- Organize projects with client details, dates, colors, and archived states.
- Browse responsive grid/list views, search clients and projects, sort, and navigate with `Ctrl/⌘ K`.
- Upload PNG, JPG, and WebP designs with progress, cancellation, and retry.
- Explore a zoomable, pannable review canvas and pin comments to exact positions.
- Reply to feedback, resolve conversations, and keep comments with their original version.
- Upload revisions and compare them with a slider or side-by-side view.
- Approve or request changes on the current version.
- Share private, expiring, revocable review links with clients who do not need an account.
- Invite editors or viewers with single-use links and switch between workspaces.
- Use light/dark themes, accessible dialogs, keyboard controls, and reduced-motion support.

## Run the full application

Start a local PostgreSQL instance, then configure the environment:

```sh
docker compose up -d db
cp .env.example .env.local
```

Set `S3_BUCKET`, `AWS_REGION`, and development AWS credentials in `.env.local`. The example database URL matches the default local Compose database. Configure bucket CORS for `http://localhost:3000`; the [S3 template](infra/s3.yaml) supplies a private bucket and appropriate CORS settings.

```sh
npm run db:migrate
npm run dev
```

Open `/register` to create an account and your personal workspace. Without S3 configuration, sign-in and project management work, while upload requests explain that storage setup is needed.

To run both the application and database in Docker instead:

```sh
cp .env.example .env
# Edit .env with your S3 configuration and local AWS credentials.
docker compose up --build
```

The Compose environment file is `.env`; native Next.js development can use `.env.local`. Prefer one configuration path at a time. No S3 emulator or alternative image-storage service is used.

## Configuration

| Variable                                     | Purpose                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `APP_URL`                                    | Exact application origin; HTTPS in production, without a trailing slash |
| `DATABASE_URL`                               | PostgreSQL connection string; use verified TLS for RDS                  |
| `AWS_REGION`                                 | Bucket region                                                           |
| `S3_BUCKET`                                  | Private upload bucket                                                   |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Local development only; prefer an EC2 instance role in production       |
| `AWS_SESSION_TOKEN`                          | Optional temporary development credentials                              |
| `TRUST_PROXY`                                | `true` only behind the supplied trusted reverse proxy                   |
| `POSTGRES_PASSWORD`                          | Local Docker database password                                          |

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
```

Integration tests use an isolated in-memory PostgreSQL WASM engine locally. Set `TEST_DATABASE_URL` to test the same routes against a normal PostgreSQL server; the suite creates and removes its own schema. GitHub Actions uses PostgreSQL 16. S3 network I/O is replaced by a test adapter; verify a real bucket upload after configuration.

## Docker and CI/CD

- Multi-stage Dockerfile with a non-root application image and a separate migration target.
- Local Compose stack with PostgreSQL health checks and ordered migrations.
- GitHub Actions checks lint, types, unit tests, PostgreSQL integration tests, a production build, and production dependency vulnerabilities.
- Successful pushes to `main` publish commit-tagged application and migration images to GHCR.
- Optional EC2 deployment uses verified SSH host keys, forward migrations, readiness checks, and application-image rollback.
- Production Compose, Nginx HTTPS configuration, private S3 infrastructure, and maintenance scripts are included.

Configure AWS resources and deployment secrets before enabling `DEPLOY_ENABLED`. Read the complete [AWS deployment guide](docs/deployment.md).

## Project map

```text
app/                  Next.js pages and backend route
components/           Workspace, review canvas, shared review, and UI
lib/server/           Authentication, authorization, SQL, validation, and S3
db/migrations/        Versioned PostgreSQL schema
scripts/              Migrations, cleanup, and deployment
infra/                Private S3 and Nginx configuration
tests/                Unit and API/database integration coverage
.github/workflows/    Verification, image publication, and deployment
```

Read [architecture](docs/architecture.md), [API reference](docs/api.md), and [deployment](docs/deployment.md) for implementation details and release boundaries.

## Design

Warm neutral surfaces, a coral accent, locally bundled DM Sans, considered spacing, and original sample artwork. Product references include [Linear](https://linear.app/), [Frame.io](https://frame.io/), and [Filestage](https://filestage.io/). Proofly has its own visual identity and implementation.
