import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Columns2,
  FolderClosed,
  LayoutGrid,
  MessageCircle,
  MousePointer2,
  Plus,
  Sparkles,
} from "lucide-react";
import { Logo, ThemeToggle } from "@/components/ui";

const cta =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-surface transition hover:opacity-85";
export default function Home() {
  return (
    <div className="overflow-hidden bg-paper">
      <header className="mx-auto flex h-22 max-w-7xl items-center justify-between gap-6 px-6 lg:px-10">
        <Logo />
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-8 text-xs text-muted sm:flex"
        >
          <a href="#how-it-works" className="hover:text-ink">
            How it works
          </a>
          <a href="#perspective" className="hover:text-ink">
            A little perspective
          </a>
          <Link href="/demo" className="hover:text-ink">
            Explore the demo
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/login" className="hidden text-xs text-muted hover:text-ink md:block">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-medium hover:bg-subtle"
          >
            Make it yours
            <ArrowRight className="ml-2 inline size-3" />
          </Link>
        </div>
      </header>
      <main>
        <section className="relative mx-auto max-w-7xl px-6 pt-17 pb-8 text-center sm:pt-23 lg:px-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-[10px] font-medium text-muted">
            <span className="size-1.5 rounded-full bg-accent" />A little less chaos. A lot more
            clarity.
            <ChevronRight className="size-3" />
          </span>
          <h1 className="mt-7 text-[56px] leading-[1.03] font-medium tracking-[-.07em] sm:text-[80px] lg:text-[98px]">
            Good work.
            <br />
            On the{" "}
            <span className="relative inline-block font-serif font-normal italic tracking-[-.065em] text-accent">
              same page.
              <svg
                aria-hidden="true"
                viewBox="0 0 470 20"
                className="absolute -bottom-3 left-0 w-full fill-none stroke-accent/45"
              >
                <path d="M5 12Q210-5 462 12" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="mx-auto mt-9 max-w-md text-sm leading-[1.9] text-muted sm:text-[15px]">
            A considered space for creative projects, thoughtful feedback,
            <br className="hidden sm:block" /> and those little{" "}
            <span className="text-ink">“yes, that’s the one”</span> moments.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className={cta}>
              Find your flow
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-medium hover:bg-subtle"
            >
              Take a little look
              <MousePointer2 className="size-3.5" />
            </Link>
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-[10px] text-muted">
            <Check className="size-3 text-[#82966e]" />
            Made for freelancers, small studios, and good collaborators.
          </p>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-49 left-2 hidden -rotate-12 text-[#b8c4a9] lg:block"
          >
            <svg width="115" height="115" viewBox="0 0 100 100" fill="none">
              <path
                d="M50 2v96M2 50h96M16 16l68 68m0-68L16 84"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <circle cx="50" cy="50" r="31" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-62 right-8 hidden rotate-12 rounded-xl border border-[#e4dbcb] bg-[#f3eddf] px-5 py-4 text-left shadow-sm lg:block"
          >
            <span className="block text-[10px] text-[#8c816e]">A note for you</span>
            <span className="mt-2 block font-serif text-xl text-[#685e4b] italic">
              Good things happen
              <br />
              with a little feedback.
            </span>
            <span className="mt-3 block text-right text-[#a59477]">↗</span>
          </div>
          <div className="relative mt-17 text-left">
            <ProductPreview />
            <span className="relative mx-auto mt-7 flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[10px] text-muted">
              <span className="size-1.5 rounded-full bg-[#97a486]" />
              Clear feedback. Confident approvals. A little room to breathe.
            </span>
          </div>
        </section>
        <section id="how-it-works" className="mx-auto max-w-7xl px-6 pt-20 pb-18 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[10px] tracking-[.15em] text-muted uppercase">
                FROM FIRST DRAFT TO FINAL YES
              </p>
              <h2 className="mt-4 text-4xl leading-[1.15] font-medium tracking-[-.055em] sm:text-5xl">
                A little structure.
                <br />
                <span className="font-serif font-normal italic text-accent">
                  A lot of possibility.
                </span>
              </h2>
            </div>
            <p className="max-w-67 text-xs leading-[1.9] text-muted">
              Keep the good ideas flowing, the conversations together, and everyone moving in the
              same direction.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <Feature
              number="01"
              title="Give your work a home."
              description="One considered space for every project, client, and version. Nothing lost in another message thread."
              icon={<FolderClosed className="size-5" />}
            >
              <div className="flex h-33 items-center justify-center gap-3">
                <div className="-rotate-9 rounded-xl bg-[#cad3bc] p-5 font-serif text-3xl text-[#5e6f4b] shadow-sm">
                  still.
                </div>
                <div className="rotate-6 rounded-xl bg-[#d5c8e2] p-5 font-serif text-3xl text-[#6e5886] shadow-sm">
                  m.
                </div>
                <div className="-rotate-3 rounded-xl bg-[#edc49c] p-5 font-serif text-3xl text-[#945d38] shadow-sm">
                  f.
                </div>
              </div>
            </Feature>
            <Feature
              number="02"
              title="Bring a little perspective."
              description="Click right where you mean. Pin thoughtful feedback to a design and keep the conversation in context."
              icon={<MessageCircle className="size-5" />}
            >
              <div className="flex h-33 items-center justify-center">
                <div className="relative w-50 rounded-xl border border-line bg-surface p-3.5 shadow-sm">
                  <span className="absolute -top-3 -left-2 flex size-7 items-center justify-center rounded-full rounded-bl-sm bg-accent text-[10px] text-white ring-4 ring-paper">
                    1
                  </span>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="size-5 rounded-full bg-[#e5d0bc]" />
                    <span className="text-[9px] font-medium">Maya Chen</span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-muted">
                    Love this direction. A little more breathing room here?
                  </p>
                </div>
              </div>
            </Feature>
            <Feature
              number="03"
              title="Find your final yes."
              description="Compare revisions, resolve the details, and approve the right version. Good work deserves a clear finish."
              icon={<CheckCheck className="size-5" />}
            >
              <div className="flex h-33 items-center justify-center">
                <div className="-rotate-4 rounded-2xl border border-[#d7e3cc] bg-[#edf2e7] px-7 py-5 text-center text-[#657d51]">
                  <span className="mx-auto mb-2 flex size-8 items-center justify-center rounded-full bg-[#d9e5cc]">
                    <Check className="size-4" />
                  </span>
                  <p className="text-xs font-medium">Yes, that’s the one.</p>
                  <p className="mt-1 text-[9px] opacity-65">Version 3 · Approved</p>
                </div>
              </div>
            </Feature>
          </div>
        </section>
        <section id="perspective" className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-18 md:grid-cols-2 lg:gap-20 lg:px-10">
            <div className="relative rounded-2xl bg-[#efebe3] p-6 sm:p-9">
              <div className="overflow-hidden rounded-xl bg-[#d9dfcd] shadow-lg">
                <img
                  src="/artwork/still.svg"
                  alt="Still skincare brand design with feedback pinned to the headline"
                  width="1200"
                  height="900"
                  className="w-full"
                />
              </div>
              <span className="absolute top-[33%] left-[29%] flex size-7 items-center justify-center rounded-full rounded-bl-sm bg-accent text-[10px] font-semibold text-white ring-3 ring-white">
                1
              </span>
              <div className="absolute right-3 -bottom-4 flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-lg sm:right-7">
                <span className="flex size-7 items-center justify-center rounded-full bg-[#e1ead8] text-[#6d8457]">
                  <Check className="size-3.5" />
                </span>
                <span>
                  <span className="block text-[11px] font-medium">
                    A little clearer. A little better.
                  </span>
                  <span className="mt-0.5 block text-[9px] text-muted">
                    Feedback resolved · Moving forward
                  </span>
                </span>
              </div>
            </div>
            <div>
              <p className="text-[10px] tracking-[.15em] text-muted uppercase">
                LESS GUESSWORK. MORE GOOD WORK.
              </p>
              <h2 className="mt-4 text-4xl leading-[1.15] font-medium tracking-[-.055em] sm:text-5xl">
                “Over here”
                <br />
                finally has{" "}
                <span className="font-serif font-normal italic text-accent">a home.</span>
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-[1.9] text-muted">
                A comment on the right version, in exactly the right place. Give your ideas the
                context they deserve and your clients a simpler way to say what they mean.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  "Feedback pinned to exact positions",
                  "Every version and conversation kept together",
                  "Simple review links for your clients",
                ].map((t) => (
                  <p key={t} className="flex items-center gap-2.5 text-xs">
                    <Check className="size-3.5 text-[#8b9c7b]" />
                    {t}
                  </p>
                ))}
              </div>
              <Link
                href="/demo"
                className="mt-7 inline-flex items-center gap-2 text-xs font-semibold text-accent"
              >
                See things a little differently
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-6 py-22 text-center lg:px-10">
          <Sparkles className="mx-auto mb-5 size-7 text-accent/75" />
          <p className="text-[10px] tracking-[.15em] text-muted uppercase">
            GOOD WORK STARTS WITH A LITTLE SPACE
          </p>
          <h2 className="mt-4 text-4xl leading-[1.15] font-medium tracking-[-.055em] sm:text-6xl">
            Make room for
            <br />
            your <span className="font-serif font-normal italic text-accent">next good thing.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-muted">
            Your projects, your people, and a little more peace of mind. All on the same page.
          </p>
          <Link href="/register" className={`${cta} mt-7`}>
            Make yourself at home
            <ArrowRight className="size-4" />
          </Link>
        </section>
      </main>
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 border-t border-line px-6 py-7 lg:px-10">
        <Logo />
        <p className="text-[10px] text-muted">A considered space for good work.</p>
        <div className="flex items-center gap-6 text-[10px] text-muted">
          <Link href="/demo" className="hover:text-ink">
            Take a look
          </Link>
          <Link href="/login" className="hover:text-ink">
            Sign in
          </Link>
          <span>© {new Date().getFullYear()} Proofly</span>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  number,
  title,
  description,
  children,
  icon,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center justify-between text-muted">
        <span className="text-[10px]">{number} /</span>
        {icon}
      </div>
      {children}
      <h3 className="mt-4 text-lg font-medium tracking-tight">{title}</h3>
      <p className="mt-3 text-xs leading-[1.9] text-muted">{description}</p>
    </article>
  );
}

function ProductPreview() {
  return (
    <Link
      href="/demo"
      aria-label="Explore the interactive Proofly workspace"
      className="relative block overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-[0_20px_80px_#4d372512] transition hover:-translate-y-1 sm:rounded-2xl sm:p-2.5"
    >
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-3">
        <span className="size-2 rounded-full bg-[#eab6a6]" />
        <span className="size-2 rounded-full bg-[#e7d4a9]" />
        <span className="size-2 rounded-full bg-[#c1d0b3]" />
        <span className="mx-auto text-[8px] text-muted">A little space for good work.</span>
      </div>
      <div className="flex">
        <div className="hidden w-42 shrink-0 border-r border-line bg-surface px-3 py-5 sm:block">
          <span className="text-xl font-bold tracking-tight">
            proofly<span className="text-accent">.</span>
          </span>
          <div className="mt-6 rounded-lg border border-line p-2 text-[9px]">Studio workspace</div>
          <p className="mt-6 mb-3 text-[7px] tracking-wider text-muted">WORKSPACE</p>
          <div className="mb-1 flex items-center gap-2 rounded-md bg-accent-soft px-2 py-2.5 text-[9px] font-medium text-accent">
            <LayoutGrid className="size-3" />
            Projects
          </div>
          <div className="flex items-center gap-2 px-2 py-2.5 text-[9px] text-muted">
            <MessageCircle className="size-3" />
            For review
          </div>
          <div className="flex items-center gap-2 px-2 py-2.5 text-[9px] text-muted">
            <CheckCheck className="size-3" />
            Approved
          </div>
          <p className="mt-6 mb-3 text-[7px] tracking-wider text-muted">RECENT PROJECTS</p>
          {["Still skincare", "Forma Studio", "Olio drinks"].map((p, i) => (
            <div key={p} className="flex items-center gap-2 py-2 text-[8px] text-muted">
              <span
                className={`size-1.5 rounded-sm ${["bg-[#b8c6aa]", "bg-[#e5d1b9]", "bg-[#f8b365]"][i]}`}
              />
              {p}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 bg-paper p-4 sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[6px] tracking-[.1em] text-muted sm:text-[7px]">
                A LITTLE CLARITY. A LOT OF PROGRESS.
              </p>
              <h2 className="mt-2 text-lg font-medium tracking-[-.05em] sm:text-3xl">
                Your work, moving forward.<span className="text-accent"> ✳</span>
              </h2>
              <p className="mt-2 hidden text-[8px] text-muted md:block">
                One home for your projects, feedback, and those little ‘nailed it’ moments.
              </p>
            </div>
            <span className="hidden items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[8px] text-surface md:flex">
              <Plus className="size-2.5" />
              New project
            </span>
          </div>
          <div className="mt-6 flex items-center justify-between border-b border-line pb-3 text-[8px]">
            <span>
              All projects <span className="ml-1 rounded bg-subtle px-1 py-0.5 text-muted">6</span>
              <span className="ml-4 text-muted">Archived</span>
            </span>
            <span className="text-muted">Latest first ↓</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
            {[
              ["still", "Still skincare", "A quieter kind of care"],
              ["forma", "Forma Studio", "Spaces with a point of view"],
              ["olio", "Olio drinks", "A fresh squeeze of something"],
            ].map(([id, client, title], i) => (
              <div
                key={id}
                className={`overflow-hidden rounded-lg border border-line bg-surface p-1.5 ${i === 2 ? "hidden lg:block" : ""}`}
              >
                <img
                  src={`/artwork/${id}.svg`}
                  alt=""
                  className="aspect-[1.4] w-full rounded-md object-cover"
                />
                <div className="px-1 pt-3 pb-2">
                  <p className="text-[6px] text-muted sm:text-[7px]">{client}</p>
                  <p className="mt-1.5 truncate text-[8px] font-medium sm:text-[9px]">{title}</p>
                  <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-[#f0edfa] px-1.5 py-1 text-[6px] text-[#8c77b5]">
                    <span className="size-0.5 rounded-full bg-current" />
                    In review
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between text-[7px] text-muted">
            <span>Good things are coming together.</span>
            <span className="flex items-center gap-1">
              <Columns2 className="size-2.5" />
              One considered workspace.
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
