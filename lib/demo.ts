import type { WorkspaceData } from "./types";

export function createDemoData(): WorkspaceData {
  const now = Date.now();
  const time = (hours: number) => new Date(now - hours * 3600000).toISOString();
  const projects = [
    { id: "still", name: "Still — a quieter kind of care", client: "Still skincare", description: "Brand identity & launch campaign", color: "#b8c6aa", dueDate: new Date(now + 3 * 86400000).toISOString() },
    { id: "forma", name: "Spaces with a point of view", client: "Forma Studio", description: "Website direction & visual identity", color: "#e5d1b9", dueDate: new Date(now + 6 * 86400000).toISOString() },
    { id: "olio", name: "A fresh squeeze of something", client: "Olio drinks", description: "Packaging & social campaign", color: "#f8b365", dueDate: new Date(now + 8 * 86400000).toISOString() },
    { id: "morrow", name: "The next chapter starts here", client: "Morrow editorial", description: "Digital publication & art direction", color: "#c4b5e1", dueDate: new Date(now + 12 * 86400000).toISOString() },
    { id: "cove", name: "Somewhere you can slow down", client: "Cove retreats", description: "Brand world & booking experience", color: "#9eb9bd", dueDate: new Date(now + 15 * 86400000).toISOString() },
    { id: "form", name: "Made for the everyday", client: "Form objects", description: "Product launch & lookbook", color: "#d7bfaa", dueDate: null },
  ].map((p, i) => ({ ...p, archived: false, createdAt: time(30 + i * 20) }));
  return {
    user: { id: "demo-user", name: "Utpal Sonowal", email: "utpal@example.com" },
    workspace: { id: "demo-workspace", name: "Studio workspace", role: "owner" },
    workspaces: [{ id: "demo-workspace", name: "Studio workspace", role: "owner" }],
    members: [ { id: "demo-user", name: "Utpal Sonowal", email: "utpal@example.com", role: "owner" }, { id: "demo-maya", name: "Maya Chen", email: "maya@example.com", role: "editor" }, { id: "demo-james", name: "James Lee", email: "james@example.com", role: "viewer" } ],
    projects,
    assets: projects.map((p, i) => ({
      id: `${p.id}-asset`, projectId: p.id, name: ["Brand direction", "Homepage exploration", "Campaign key visual", "Cover exploration", "Brand world", "Autumn lookbook"][i],
      versions: [
        ...(i === 0 ? [{ id: "still-v1", number: 1, previewUrl: "/artwork/still-v1.svg", width: 1200, height: 900, byteSize: 168000, contentType: "image/svg+xml", createdAt: time(26), decision: "changes_requested" as const }] : []),
        { id: `${p.id}-v${i === 0 ? 2 : 1}`, number: i === 0 ? 2 : 1, previewUrl: `/artwork/${p.id}.svg`, width: 1200, height: 900, byteSize: 182000 + i * 24000, contentType: "image/svg+xml", createdAt: time(i * 3 + 1), decision: i === 4 ? "approved" as const : i === 2 ? "changes_requested" as const : "in_review" as const },
      ],
    })),
    comments: [
      { id: "comment-1", versionId: "still-v2", authorId: "demo-maya", authorName: "Maya Chen", body: "Love this direction. Could we give the headline a little more breathing room?", x: .25, y: .32, parentId: null, resolved: false, createdAt: time(2) },
      { id: "comment-2", versionId: "still-v2", authorId: "demo-james", authorName: "James Lee", body: "The softer green feels much closer to the brand. Really nice balance.", x: .70, y: .6, parentId: null, resolved: true, createdAt: time(3) },
      { id: "comment-3", versionId: "still-v2", authorId: "demo-user", authorName: "Utpal Sonowal", body: "Agreed — adjusted the palette in this version.", x: null, y: null, parentId: "comment-2", resolved: false, createdAt: time(2.5) },
      { id: "comment-4", versionId: "olio-v1", authorId: "demo-maya", authorName: "Maya Chen", body: "Let's increase the contrast on the smaller packaging text.", x: .56, y: .68, parentId: null, resolved: false, createdAt: time(5) },
      { id: "comment-5", versionId: "forma-v1", authorId: "demo-james", authorName: "James Lee", body: "This composition is feeling strong. Ready for the next review.", x: null, y: null, parentId: null, resolved: false, createdAt: time(6) },
    ],
    activity: [
      { id: "event-1", title: "You uploaded a new version", detail: "Brand direction · Still skincare", createdAt: time(1) },
      { id: "event-2", title: "Maya left feedback", detail: "Still — a quieter kind of care", createdAt: time(2) },
      { id: "event-3", title: "Cove brand world was approved", detail: "Cove retreats · Version 1", createdAt: time(12) },
    ],
  };
}
