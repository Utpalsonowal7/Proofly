import type { Metadata } from "next";
import { WorkspaceApp } from "@/components/workspace";
import { createDemoData } from "@/lib/demo";
export const metadata: Metadata = { title: "Your creative workspace", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default function DemoPage() { return <WorkspaceApp initialData={createDemoData()} demo/>; }
