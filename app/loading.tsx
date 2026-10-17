export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading your workspace"
      className="flex min-h-dvh items-center justify-center gap-3 text-sm text-muted"
    >
      <span className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" />
      Making a little space…
    </div>
  );
}
