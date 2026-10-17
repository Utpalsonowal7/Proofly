import type { Asset, Decision, Project } from "./types";

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}
export function latestVersion(asset: Asset) {
  return [...asset.versions].sort((a, b) => b.number - a.number)[0];
}
export function projectDecision(project: Project, assets: Asset[]): Decision | "empty" {
  const decisions = assets
    .filter((a) => a.projectId === project.id)
    .map((a) => latestVersion(a)?.decision)
    .filter(Boolean);
  if (!decisions.length) return "empty";
  if (decisions.every((d) => d === "approved")) return "approved";
  return decisions.includes("changes_requested") ? "changes_requested" : "in_review";
}
export const decisionLabel = {
  in_review: "In review",
  approved: "Approved",
  changes_requested: "Changes requested",
  empty: "No files yet",
};
export function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
export function relativeTime(date: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}
export function readableDate(date: string | null) {
  return date
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(
        new Date(date),
      )
    : "No due date";
}
