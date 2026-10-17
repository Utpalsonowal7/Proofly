# API reference

All endpoints are inside the Next.js application under `/api`. JSON responses use `Cache-Control: no-store`. Mutations require the configured application `Origin`, `Content-Type: application/json` (except DELETE), and the permissions described below. Authenticated routes use the `proofly_session` cookie. Errors return `{ "error": "A readable explanation" }`.

| Method    | Path                                    | Access / purpose                                                                            |
| --------- | --------------------------------------- | ------------------------------------------------------------------------------------------- |
| GET, HEAD | `/health/live`                          | Process liveness                                                                            |
| GET, HEAD | `/health`                               | Database and storage configuration readiness                                                |
| POST      | `/auth/register`                        | Name, email, password of at least 12 characters; creates a personal workspace               |
| POST      | `/auth/login`                           | Email/password; creates a seven-day session                                                 |
| POST      | `/auth/logout`                          | Revokes the current session and clears its cookie                                           |
| GET       | `/workspace`                            | Current user, memberships, projects, ready versions, comments, activity                     |
| PATCH     | `/workspace`                            | Owner; update workspace name                                                                |
| POST      | `/workspace/switch`                     | Member; select a workspace with `workspaceId`                                               |
| POST      | `/projects`                             | Editor; create name, client, description, color, dueDate                                    |
| PATCH     | `/projects/:id`                         | Editor; update project fields or archived state                                             |
| POST      | `/uploads`                              | Editor; reserve projectId, optional assetId, filename, contentType, byteSize, width, height |
| POST      | `/uploads/:id/complete`                 | Upload creator; validate and finalize an S3 upload; idempotent                              |
| GET       | `/versions/:id/preview`                 | Member; redirect to a short-lived private preview; add `?download=1` for attachment         |
| POST      | `/versions/:id/comments`                | Member; body, optional x/y and parentId                                                     |
| PATCH     | `/comments/:id`                         | Editor; set root conversation resolved state                                                |
| PATCH     | `/versions/:id`                         | Editor; approve or request changes on the current version                                   |
| GET, POST | `/projects/:id/review-links`            | Editor; list link metadata or create a 1/7/30-day link                                      |
| DELETE    | `/review-links/:id`                     | Editor; revoke a project review link                                                        |
| GET       | `/reviews/:token`                       | Current bearer link; fetch only its project’s review data                                   |
| GET       | `/reviews/:token/versions/:id/preview`  | Current bearer link scoped to the version’s project                                         |
| POST      | `/reviews/:token/versions/:id/comments` | Feedback-enabled link; body and reviewer authorName                                         |
| PATCH     | `/reviews/:token/versions/:id`          | Feedback-enabled link; current version decision and authorName                              |
| POST      | `/invites`                              | Owner; create a single-use editor/viewer invitation                                         |
| GET       | `/invites/:token`                       | Authenticated user; inspect an unused, current invitation                                   |
| POST      | `/invites/:token/accept`                | Authenticated user; join its workspace and consume the invitation                           |

## Examples

Pinned comment coordinates are normalized to the image, so they remain correct when a preview is resized or zoomed:

```json
{ "body": "A little more breathing room here.", "x": 0.25, "y": 0.4 }
```

A reply references a root conversation on the same version and has no pin:

```json
{ "body": "Agreed — adjusted in the next version.", "parentId": "ROOT_COMMENT_UUID" }
```

Version decisions use these values:

```json
{ "decision": "approved" }
```

```json
{ "decision": "changes_requested", "authorName": "Client name" }
```

Raw session, review, and invitation tokens are never included in workspace data. New review/invitation URLs are shown only in the create response; the database stores their hashes. A link’s stored ID is used for revocation.
