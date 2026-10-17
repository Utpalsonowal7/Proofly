import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
export const metadata: Metadata = { title: "Make yourself at home", robots: { index: false, follow: false } };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) { const params = await searchParams; return <AuthForm mode="register" next={params.next}/>; }
