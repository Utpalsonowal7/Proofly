export type Decision = "in_review" | "approved" | "changes_requested";
export type Role = "owner" | "editor" | "viewer";
export type User = { id: string; name: string; email: string };
export type Member = { id: string; name: string; email: string; role: Role };
export type Project = {
  id: string; name: string; client: string; description: string; color: string;
  dueDate: string | null; archived: boolean; createdAt: string;
};
export type AssetVersion = {
  id: string; number: number; previewUrl: string; width: number; height: number;
  byteSize: number; contentType: string; createdAt: string; decision: Decision;
};
export type Asset = { id: string; projectId: string; name: string; versions: AssetVersion[] };
export type Comment = {
  id: string; versionId: string; authorId: string | null; authorName: string;
  body: string; x: number | null; y: number | null; parentId: string | null;
  resolved: boolean; createdAt: string;
};
export type Activity = { id: string; title: string; detail: string; createdAt: string };
export type WorkspaceData = {
  user: User; workspace: { id: string; name: string; role: Role };
  workspaces: { id: string; name: string; role: Role }[];
  members: Member[]; projects: Project[]; assets: Asset[]; comments: Comment[]; activity: Activity[];
};
export type ReviewData = {
  project: Project; assets: Asset[]; comments: Comment[]; allowComments: boolean; workspaceName: string;
};
