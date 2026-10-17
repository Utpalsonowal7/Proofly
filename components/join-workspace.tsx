"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Users } from "lucide-react";
import { Button, Logo } from "./ui";
import { api } from "@/lib/client-api";
export function JoinWorkspace({ token, workspaceName, inviterName, role }: { token: string; workspaceName: string; inviterName: string; role: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""); const router = useRouter();
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6"><Logo/><span className="mt-12 mb-6 flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Users className="size-5"/></span><p className="text-[10px] tracking-widest text-muted">A LITTLE GOOD COMPANY</p><h1 className="mt-4 text-4xl leading-tight font-medium tracking-[-.055em]">You’re invited<br/>to <span className="font-serif italic text-accent">{workspaceName}.</span></h1><p className="mt-5 text-sm leading-relaxed text-muted">{inviterName} made room for you. Join as an {role === "editor" ? "editor to upload designs and manage feedback" : "observer to view designs and leave feedback"}.</p>{error && <p role="alert" className="mt-4 text-xs text-red-600">{error}</p>}<Button loading={busy} className="mt-8 w-fit" onClick={async () => { setBusy(true); try { await api(`/invites/${token}/accept`, { method: "POST", body: "{}" }); router.push("/workspace"); router.refresh(); } catch (e) { setError((e as Error).message); setBusy(false); } }}>Make yourself at home<ArrowRight className="size-4"/></Button><p className="mt-6 text-xs leading-relaxed text-muted">You can switch between your workspaces in settings.</p></main>;
}
