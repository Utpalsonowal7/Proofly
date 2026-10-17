import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { JoinWorkspace } from "@/components/join-workspace";
import { getSession } from "@/lib/server/auth";
import { invitation } from "@/lib/server/data";
import { ApiError, SESSION_COOKIE, tokenPattern } from "@/lib/server/security";
export const metadata: Metadata = { title: "A little good company", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; if (!tokenPattern.test(token)) notFound();
  const session = await getSession((await cookies()).get(SESSION_COOKIE)?.value); if (!session) redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
  let info;
  try { info = await invitation(token); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  return <JoinWorkspace token={token} workspaceName={info.workspace_name} inviterName={info.inviter_name} role={info.role}/>;
}
