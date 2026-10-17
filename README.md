# Proofly

**Good work. On the same page.**

A premium creative review workspace for freelancers and their clients. Organize projects, upload designs, pin feedback to exact positions, compare revisions, and approve the right version.

## Stack

Next.js App Router · React · TypeScript · Tailwind CSS · PostgreSQL · Amazon S3 · Docker · GitHub Actions

The frontend and backend run in one Next.js application. Amazon S3 is the only uploaded-file storage provider.

## Development

Requires Node.js 24.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

## Delivery stages

1. Application foundation.
2. Creative workspace, interactive review canvas, and demo experience.
3. Authentication, private S3 uploads, versioned feedback, and approvals.
4. Docker, continuous integration, AWS deployment, and verification.

## Design direction

Warm neutral surfaces, coral accents, precise typography, and a focused review canvas. Product references: [Linear](https://linear.app/), [Frame.io](https://frame.io/), and [Filestage](https://filestage.io/). Proofly has its own visual identity and implementation.
