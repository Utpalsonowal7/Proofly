import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedReview } from "@/components/shared-review";
import { loadReview } from "@/lib/server/data";
import { ApiError } from "@/lib/server/security";
export const metadata: Metadata = {
  title: "A little perspective",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";
export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let data;
  try {
    data = await loadReview(token);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return <SharedReview initialData={data} token={token} />;
}
