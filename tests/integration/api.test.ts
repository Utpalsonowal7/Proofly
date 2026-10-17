import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { handleApi } from "../../lib/server/router";
import { closeDatabase, query, setDatabaseForTesting } from "../../lib/server/db";
import { memoryPostgres } from "../support/memory-postgres";
import { ApiError, rateLimit, tokenHash } from "../../lib/server/security";
import type { Storage, UploadRecord } from "../../lib/server/storage";
import type { WorkspaceData, Project, Comment, ReviewData } from "../../lib/types";

test("workspace API: authentication, isolation, upload lifecycle, reviews, and team access", async (t) => {
  Object.assign(process.env, { NODE_ENV: "test" });
  process.env.APP_URL = "http://localhost:3000";
  process.env.AWS_REGION = "ap-south-1";
  process.env.S3_BUCKET = "proofly-test";
  process.env.TRUST_PROXY = "false";
  await closeDatabase();
  if (process.env.TEST_DATABASE_URL) {
    const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const schema = `proofly_test_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const connection = new URL(process.env.TEST_DATABASE_URL);
    connection.searchParams.set("options", `-c search_path=${schema}`);
    process.env.DATABASE_URL = connection.toString();
    t.after(async () => {
      await closeDatabase();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
  } else {
    process.env.DATABASE_URL = "postgresql://test-only";
    setDatabaseForTesting(await memoryPostgres());
    t.after(closeDatabase);
  }
  await query(
    await readFile(new URL("../../db/migrations/001_initial.sql", import.meta.url), "utf8"),
  );
  let finalizations = 0,
    failUpload = false;
  const reservations: UploadRecord[] = [];
  const storage: Storage = {
    async prepare(record) {
      reservations.push(record);
      return { url: "https://s3.example.test", fields: { key: record.uploadKey } };
    },
    async finalize(record) {
      if (failUpload) throw new ApiError(422, "Invalid image");
      finalizations++;
      return { width: record.width, height: record.height };
    },
    async preview(record) {
      return `https://s3.example.test/${record.storageKey}?signed=yes`;
    },
  };
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    cookie = "",
    origin = "http://localhost:3000",
  ) {
    return handleApi(
      new Request(`http://localhost:3000/api${path}`, {
        method,
        headers: { origin, cookie, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      storage,
    );
  }
  const password = "a-long-unique-test-password";
  let alpha = "",
    beta = "",
    gamma = "";
  let project: Project, otherProject: Project;
  let uploadId = "",
    assetId = "",
    currentId = "",
    rootComment: Comment;
  let shareToken = "",
    linkId = "",
    viewToken = "";

  await t.test("creates private sessions and independent workspaces", async () => {
    for (const [name, email, assign] of [
      [
        "Alex One",
        "alex@example.test",
        (v: string) => {
          alpha = v;
        },
      ],
      [
        "Blair Two",
        "blair@example.test",
        (v: string) => {
          beta = v;
        },
      ],
      [
        "Cameron Three",
        "cameron@example.test",
        (v: string) => {
          gamma = v;
        },
      ],
    ] as const) {
      const response = await request("/auth/register", "POST", { name, email, password });
      assert.equal(response.status, 201);
      assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
      assign(response.headers.get("set-cookie")!.split(";")[0]);
    }
    assert.equal((await request("/workspace")).status, 401);
    const a: WorkspaceData = await (await request("/workspace", "GET", undefined, alpha)).json();
    const b: WorkspaceData = await (await request("/workspace", "GET", undefined, beta)).json();
    assert.notEqual(a.workspace.id, b.workspace.id);
    assert.equal(a.workspace.role, "owner");
    assert.equal(a.assets.length, 0);
    assert.ok(!JSON.stringify(a).includes("password_hash"));
    assert.equal(
      (await request("/auth/login", "POST", { email: "alex@example.test", password: "wrong" }))
        .status,
      401,
    );
    assert.equal(
      (
        await request("/auth/register", "POST", {
          name: "Again",
          email: "alex@example.test",
          password,
        })
      ).status,
      409,
    );
  });
  await t.test("creates projects and blocks cross-workspace modification", async () => {
    const a = await request(
      "/projects",
      "POST",
      { name: "Still campaign", client: "Still", dueDate: "2026-10-30" },
      alpha,
    );
    assert.equal(a.status, 201);
    project = await a.json();
    const b = await request("/projects", "POST", { name: "Other campaign" }, beta);
    otherProject = await b.json();
    assert.equal(
      (await request(`/projects/${project.id}`, "PATCH", { name: "Stolen project" }, beta)).status,
      404,
    );
    assert.equal(
      (await request("/projects/not-a-uuid", "PATCH", { name: "Bad" }, alpha)).status,
      404,
    );
    const update = await request(`/projects/${project.id}`, "PATCH", { archived: true }, alpha);
    assert.equal(update.status, 200);
    assert.equal((await update.json()).archived, true);
    await request(`/projects/${project.id}`, "PATCH", { archived: false }, alpha);
  });
  await t.test("rejects cross-origin mutations and oversized bodies", async () => {
    assert.equal(
      (await request("/projects", "POST", { name: "Bad origin" }, alpha, "https://other.test"))
        .status,
      403,
    );
    assert.equal(
      (await request("/projects", "POST", { name: "x".repeat(17000) }, alpha)).status,
      413,
    );
    assert.equal(
      (await request("/projects", "POST", { name: "Bad date", dueDate: "2026-02-30" }, alpha))
        .status,
      422,
    );
  });
  await t.test("reserves uploads privately and finalizes only for the uploader", async () => {
    const response = await request(
      "/uploads",
      "POST",
      {
        projectId: project.id,
        filename: "brand.png",
        contentType: "image/png",
        byteSize: 100,
        width: 600,
        height: 400,
      },
      alpha,
    );
    assert.equal(response.status, 201);
    uploadId = (await response.json()).id;
    assert.match(reservations[0].uploadKey, /^staging\//);
    assert.match(reservations[0].storageKey, /^workspaces\//);
    assert.notEqual(reservations[0].uploadKey, reservations[0].storageKey);
    let state: WorkspaceData = await (await request("/workspace", "GET", undefined, alpha)).json();
    assert.equal(state.assets.length, 0);
    assert.equal((await request(`/uploads/${uploadId}/complete`, "POST", {}, beta)).status, 404);
    failUpload = true;
    assert.equal((await request(`/uploads/${uploadId}/complete`, "POST", {}, alpha)).status, 422);
    failUpload = false;
    state = await (await request("/workspace", "GET", undefined, alpha)).json();
    assert.equal(state.assets.length, 0);
    assert.equal((await request(`/uploads/${uploadId}/complete`, "POST", {}, alpha)).status, 200);
    assert.equal((await request(`/uploads/${uploadId}/complete`, "POST", {}, alpha)).status, 200);
    assert.equal(finalizations, 1);
    state = await (await request("/workspace", "GET", undefined, alpha)).json();
    assetId = state.assets[0].id;
    assert.equal(state.assets[0].versions[0].number, 1);
    assert.ok(!JSON.stringify(state).includes("storage_key"));
    assert.ok(!JSON.stringify(state).includes("staging/"));
    assert.equal(
      (await request(`/versions/${uploadId}/preview`, "GET", undefined, beta)).status,
      404,
    );
    const preview = await request(`/versions/${uploadId}/preview`, "GET", undefined, alpha);
    assert.equal(preview.status, 307);
    assert.equal(preview.headers.get("cache-control"), "no-store");
  });
  await t.test("pins feedback to the version and scopes replies and resolution", async () => {
    const comment = await request(
      `/versions/${uploadId}/comments`,
      "POST",
      { body: "A little more breathing room", x: 0.25, y: 0.75 },
      alpha,
    );
    assert.equal(comment.status, 201);
    rootComment = await comment.json();
    assert.equal(rootComment.versionId, uploadId);
    assert.equal(rootComment.x, 0.25);
    assert.equal(
      (
        await request(
          `/versions/${uploadId}/comments`,
          "POST",
          { body: "Agreed", parentId: rootComment.id },
          alpha,
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await request(
          `/versions/${uploadId}/comments`,
          "POST",
          { body: "Invalid", parentId: randomUUID() },
          alpha,
        )
      ).status,
      404,
    );
    assert.equal(
      (await request(`/comments/${rootComment.id}`, "PATCH", { resolved: true }, beta)).status,
      404,
    );
    assert.equal(
      (await request(`/comments/${rootComment.id}`, "PATCH", { resolved: true }, alpha)).status,
      200,
    );
  });
  await t.test(
    "serializes concurrent version reservations and preserves the latest finalization",
    async () => {
      const body = {
        projectId: project.id,
        assetId,
        filename: "brand-v2.png",
        contentType: "image/png",
        byteSize: 100,
        width: 600,
        height: 400,
      };
      const responses = await Promise.all([
        request("/uploads", "POST", body, alpha),
        request("/uploads", "POST", body, alpha),
      ]);
      for (const response of responses) assert.equal(response.status, 201);
      const ids = await Promise.all(responses.map((r) => r.json()));
      const rows = (
        await query(
          "SELECT id, version_number FROM asset_versions WHERE asset_id = $1 ORDER BY version_number",
          [assetId],
        )
      ).rows;
      assert.deepEqual(
        rows.map((r) => r.version_number),
        [1, 2, 3],
      );
      currentId = rows[2].id;
      assert.ok(ids.some((r) => r.id === currentId));
      await request(`/uploads/${rows[2].id}/complete`, "POST", {}, alpha);
      await request(`/uploads/${rows[1].id}/complete`, "POST", {}, alpha);
      assert.equal(
        (await query("SELECT current_version_id FROM assets WHERE id = $1", [assetId])).rows[0]
          .current_version_id,
        currentId,
      );
      assert.equal(
        (await request(`/versions/${uploadId}`, "PATCH", { decision: "approved" }, alpha)).status,
        409,
      );
      assert.equal(
        (await request(`/versions/${currentId}`, "PATCH", { decision: "approved" }, alpha)).status,
        200,
      );
    },
  );
  await t.test("shares only the intended project and requires named guest feedback", async () => {
    const response = await request(
      `/projects/${project.id}/review-links`,
      "POST",
      { expiresInDays: 7, allowComments: true },
      alpha,
    );
    assert.equal(response.status, 201);
    shareToken = (await response.json()).url.split("/").pop();
    const link = (
      await query("SELECT id, token_hash FROM review_links WHERE project_id = $1", [project.id])
    ).rows[0];
    linkId = link.id;
    assert.equal(link.token_hash, tokenHash(shareToken));
    const review: ReviewData = await (await request(`/reviews/${shareToken}`)).json();
    assert.equal(review.project.id, project.id);
    assert.ok(!JSON.stringify(review).includes(otherProject.id));
    assert.equal(
      (
        await request(`/reviews/${shareToken}/versions/${currentId}/comments`, "POST", {
          body: "Looks good",
        })
      ).status,
      422,
    );
    const comment = await request(`/reviews/${shareToken}/versions/${currentId}/comments`, "POST", {
      body: "Looks good",
      authorName: "Client One",
      x: 0.5,
      y: 0.5,
    });
    assert.equal(comment.status, 201);
    assert.equal((await comment.json()).authorId, null);
    assert.equal(
      (await request(`/reviews/${shareToken}/versions/${randomUUID()}/preview`)).status,
      404,
    );
    assert.equal(
      (
        await request(`/reviews/${shareToken}/versions/${currentId}`, "PATCH", {
          decision: "changes_requested",
          authorName: "Client One",
        })
      ).status,
      200,
    );
  });
  await t.test("view-only links block feedback and decisions", async () => {
    viewToken = (
      await (
        await request(
          `/projects/${project.id}/review-links`,
          "POST",
          { allowComments: false },
          alpha,
        )
      ).json()
    ).url
      .split("/")
      .pop();
    assert.equal((await request(`/reviews/${viewToken}`)).status, 200);
    assert.equal(
      (
        await request(`/reviews/${viewToken}/versions/${currentId}/comments`, "POST", {
          body: "Not allowed",
          authorName: "Client",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(`/reviews/${viewToken}/versions/${currentId}`, "PATCH", {
          decision: "approved",
          authorName: "Client",
        })
      ).status,
      403,
    );
  });
  await t.test("revocation and expiry stop previews, writes, and review access", async () => {
    assert.equal((await request(`/review-links/${linkId}`, "DELETE", undefined, beta)).status, 404);
    assert.equal(
      (await request(`/review-links/${linkId}`, "DELETE", undefined, alpha)).status,
      200,
    );
    assert.equal((await request(`/reviews/${shareToken}`)).status, 404);
    assert.equal(
      (await request(`/reviews/${shareToken}/versions/${currentId}/preview`)).status,
      404,
    );
    assert.equal(
      (
        await request(`/reviews/${shareToken}/versions/${currentId}/comments`, "POST", {
          body: "Too late",
          authorName: "Client",
        })
      ).status,
      404,
    );
    await query(
      "UPDATE review_links SET expires_at = now() - interval '1 second' WHERE token_hash = $1",
      [tokenHash(viewToken)],
    );
    assert.equal((await request(`/reviews/${viewToken}`)).status, 404);
  });
  await t.test("single-use invitations grant only their assigned role", async () => {
    const result = await request("/invites", "POST", { role: "viewer" }, alpha);
    const invite = (await result.json()).url.split("/").pop();
    assert.equal((await request(`/invites/${invite}/accept`, "POST", {}, beta)).status, 200);
    assert.equal((await request(`/invites/${invite}/accept`, "POST", {}, gamma)).status, 404);
    const workspace: WorkspaceData = await (
      await request("/workspace", "GET", undefined, beta)
    ).json();
    assert.equal(workspace.workspace.role, "viewer");
    assert.equal(workspace.workspaces.length, 2);
    assert.equal((await request("/projects", "POST", { name: "Not allowed" }, beta)).status, 403);
    assert.equal(
      (await request(`/versions/${currentId}`, "PATCH", { decision: "approved" }, beta)).status,
      403,
    );
    assert.equal((await request("/invites", "POST", { role: "editor" }, beta)).status, 403);
    assert.equal(
      (await request(`/versions/${currentId}/comments`, "POST", { body: "Viewer feedback" }, beta))
        .status,
      201,
    );
    const own = workspace.workspaces.find((w) => w.role === "owner")!;
    assert.equal(
      (await request("/workspace/switch", "POST", { workspaceId: own.id }, beta)).status,
      200,
    );
    assert.equal(
      (await request("/workspace/switch", "POST", { workspaceId: randomUUID() }, beta)).status,
      404,
    );
  });
  await t.test("persistent rate limits reset by time and sessions revoke on logout", async () => {
    await rateLimit("integration-key", 1, 60);
    await assert.rejects(
      rateLimit("integration-key", 1, 60),
      (e: unknown) => e instanceof ApiError && e.status === 429,
    );
    await query("UPDATE rate_limits SET resets_at = now() - interval '1 second' WHERE key = $1", [
      tokenHash("integration-key"),
    ]);
    await rateLimit("integration-key", 1, 60);
    assert.equal((await request("/health", "HEAD")).status, 200);
    const response = await request("/auth/logout", "POST", {}, alpha);
    assert.match(response.headers.get("set-cookie")!, /Max-Age=0/);
    assert.equal((await request("/workspace", "GET", undefined, alpha)).status, 401);
    const login = await request("/auth/login", "POST", { email: "alex@example.test", password });
    assert.equal(login.status, 200);
    assert.notEqual(login.headers.get("set-cookie")!.split(";")[0], alpha);
  });
});
