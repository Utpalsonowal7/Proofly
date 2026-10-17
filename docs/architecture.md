# How Proofly works

Proofly is one Next.js application with React client components for the interactive workspace and Node.js route handlers for its backend. PostgreSQL stores users, memberships, opaque sessions, projects, version metadata, feedback, review decisions, invitations, and activity. Amazon S3 is the only uploaded-file storage provider.

## An image’s journey

1. An authenticated editor reserves an upload for a project they can access. Version numbers are allocated while holding a row lock on the asset.
2. The backend returns a five-minute S3 POST policy for one randomly generated staging key, one content type, and an exact file size. Browser requests never receive AWS credentials.
3. The browser uploads directly to the private bucket and reports progress. Cancellation stops the request; abandoned staging objects expire through the bucket lifecycle policy.
4. The completion endpoint checks ownership, the reservation age, S3 metadata, the file signature, and image dimensions. Static PNG, JPEG, and WebP images up to 20 MB and 50 megapixels are supported.
5. Validated content is copied to a separate final key using an ETag precondition. The browser’s staging policy cannot overwrite that final key. A transaction marks the version ready and advances the current version only when its version number is newer.
6. Previews require a valid workspace session or a current project review link, then redirect to a two-minute S3 download URL. The bucket stays private.

Image previews are loaded through normal image elements because their URLs represent authenticated, expiring content. Remote optimizer caching is deliberately avoided. The included sample SVG artwork is trusted, static application content; uploaded SVG files are not accepted.

## Identity and permissions

- Passwords use scrypt with independent salts. Sessions use random 256-bit opaque tokens; PostgreSQL stores only their SHA-256 digests.
- Session cookies are HttpOnly, SameSite=Lax, and Secure for HTTPS. They expire after seven days and are revoked on logout.
- Mutations require the configured application origin and JSON requests. Bodies are bounded to 16 KB before parsing.
- Owners manage workspace details and create single-use invitations. Editors manage projects, uploads, links, conversations, and approvals. Viewers can view and comment, but cannot upload, approve, or change settings.
- Every project, version, and conversation lookup checks membership in the user’s selected workspace. A client-supplied workspace ID never grants access.
- Users retain their personal workspace after accepting a team invitation and can switch workspaces in settings.
- Authentication, upload, review, and mutation limits use PostgreSQL upserts, so limits survive restarts and apply across processes. The supplied proxy overwrites X-Real-IP; `TRUST_PROXY=true` must be used only behind that proxy.

## Client reviews

Review URLs are bearer capabilities. Only token hashes are persisted. Links expire after 1, 7, or 30 days and can be revoked. They cover a single project and its ready versions. View-only links cannot comment or make decisions. Feedback-enabled links accept a reviewer-provided display name and permit version-specific approval or change requests. A guest name is a label, not a verified identity.

Decisions apply only to an asset’s current version. Publishing a revision starts a fresh review while keeping previous feedback and decisions. Old versions can still be viewed and discussed. A project is approved only when every current asset version is approved. Previously issued S3 URLs can remain usable for at most two minutes after a link is revoked.

## Client state and responsiveness

The workspace supports grid/list views, filtering, sorting, keyboard search, mobile navigation, light/dark themes, and loading, empty, and error states. The canvas supports zoom, panning, normalized comment coordinates, version switching, and image comparison. Modal focus stays inside the active dialog and returns to its trigger. Motion respects the user’s reduced-motion preference.

Public review pages refresh their data every 20 seconds while visible. Other workspace changes are loaded after a mutation or on page refresh. The application does not use a live multiplayer transport.

The `/demo` workspace uses local sample artwork and browser-persisted text changes. Demo upload previews are temporary object URLs that stay only in the current tab; they are excluded from persisted demo data. The authenticated application always saves uploaded content to S3.

## Verification

Unit tests cover password handling, session properties, origin checks, bounded bodies, upload validation, normalized pins, version ordering, and project approval logic. Integration tests exercise the route handlers, SQL schema, transactions, authorization, and complete review lifecycle. The local fallback uses a WebAssembly PostgreSQL engine with serialized connections. GitHub Actions supplies a PostgreSQL 16 service and tests the same API paths against it. S3 I/O is replaced by a storage adapter in API integration tests; a real bucket is required to verify an actual upload.

## Boundaries of this release

This release focuses on static images. PDF/video review, email verification, password reset, billing, and live cursor presence are not implemented. Review links and team invitation links are copied and shared by the user. No external email, image hosting, or authentication provider is required.
