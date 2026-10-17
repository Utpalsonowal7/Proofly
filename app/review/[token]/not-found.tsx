import Link from "next/link";
import { Logo } from "@/components/ui";
export default function ReviewUnavailable() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <Logo />
      <p className="mt-12 text-[10px] tracking-widest text-muted">A FRESH LINK, PERHAPS?</p>
      <h1 className="mt-4 text-4xl leading-tight font-medium tracking-[-.055em]">
        This review has
        <br />
        turned a page.
      </h1>
      <p className="mt-5 text-sm leading-relaxed text-muted">
        The link may have expired or been revoked. Ask the project owner for a new review link to
        pick up where you left off.
      </p>
      <Link
        href="/"
        className="mt-7 w-fit rounded-xl border border-line bg-surface px-4 py-3 text-sm"
      >
        Back to Proofly →
      </Link>
    </main>
  );
}
