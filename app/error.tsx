"use client";
import { Logo, Button } from "@/components/ui";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <Logo />
      <h1 className="mt-12 text-4xl font-medium tracking-tight">A little pause.</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Something interrupted this page. Give it another try, and we’ll help you pick up where you
        left off.
      </p>
      <Button onClick={reset} className="mt-7 w-fit">
        Try again
      </Button>
    </main>
  );
}
