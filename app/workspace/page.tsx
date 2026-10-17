import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceApp } from "@/components/workspace";
import { getSession } from "@/lib/server/auth";
import { loadWorkspace } from "@/lib/server/data";
import { SESSION_COOKIE } from "@/lib/server/security";
export const metadata: Metadata = {
  title: "Your creative workspace",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function WorkspacePage() {
  const session = await getSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  return <WorkspaceApp initialData={await loadWorkspace(session)} />;
}
