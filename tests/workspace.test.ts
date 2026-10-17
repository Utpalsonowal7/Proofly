import assert from "node:assert/strict";
import test from "node:test";
import { createDemoData } from "../lib/demo";
import { latestVersion, projectDecision } from "../lib/format";

test("project approval requires every current asset version to be approved", () => {
  const data = createDemoData();
  const project = data.projects[0];
  assert.equal(projectDecision(project, []), "empty");
  assert.equal(projectDecision(project, data.assets), "in_review");
  const asset = structuredClone(data.assets[0]);
  latestVersion(asset).decision = "approved";
  assert.equal(projectDecision(project, [asset]), "approved");
  const extra = structuredClone(asset);
  extra.id = "second";
  latestVersion(extra).decision = "changes_requested";
  assert.equal(projectDecision(project, [asset, extra]), "changes_requested");
});
test("version ordering does not mutate the original collection or count older decisions", () => {
  const data = createDemoData();
  const asset = data.assets[0];
  const original = asset.versions.map((v) => v.id);
  assert.equal(latestVersion(asset).number, 2);
  assert.deepEqual(
    asset.versions.map((v) => v.id),
    original,
  );
  asset.versions[0].decision = "approved";
  assert.equal(projectDecision(data.projects[0], [asset]), "in_review");
});
test("the demo has usable artwork, consistent comment references, and a comparison pair", () => {
  const data = createDemoData();
  const versionIds = new Set(data.assets.flatMap((a) => a.versions.map((v) => v.id)));
  assert.ok(data.assets.some((a) => a.versions.length > 1));
  for (const comment of data.comments) {
    assert.ok(versionIds.has(comment.versionId));
    if (comment.parentId)
      assert.ok(
        data.comments.some((p) => p.id === comment.parentId && p.versionId === comment.versionId),
      );
  }
  for (const asset of data.assets) {
    assert.ok(data.projects.some((p) => p.id === asset.projectId));
    for (const version of asset.versions) assert.match(version.previewUrl, /^\/artwork\//);
  }
});
