"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  Columns2,
  Download,
  Hand,
  MessageCircle,
  Minus,
  MousePointer2,
  Plus,
  Send,
  Upload,
  X,
} from "lucide-react";
import { Avatar, Button, IconButton, Modal, Select, inputClass, useToast } from "./ui";
import { decisionLabel, formatBytes, latestVersion, relativeTime } from "@/lib/format";
import type { Asset, AssetVersion, Comment, Decision, Project } from "@/lib/types";

export type NewComment = {
  body: string;
  x: number | null;
  y: number | null;
  parentId?: string | null;
  authorName?: string;
};
type Props = {
  project: Project;
  assets: Asset[];
  comments: Comment[];
  initialAssetId: string;
  canEdit: boolean;
  canDecide?: boolean;
  allowComments?: boolean;
  guest?: boolean;
  onClose: () => void;
  onComment: (versionId: string, values: NewComment) => Promise<void>;
  onResolve: (commentId: string, resolved: boolean) => Promise<void>;
  onDecision: (versionId: string, decision: Decision, authorName?: string) => Promise<void>;
  onUpload?: (assetId: string) => void;
};

export function ReviewPanel(props: Props) {
  const [assetId, setAssetId] = useState(props.initialAssetId);
  const asset = props.assets.find((a) => a.id === assetId) ?? props.assets[0];
  if (!asset) return null;
  return <ReviewAsset key={asset.id} {...props} asset={asset} onSelectAsset={setAssetId} />;
}

function ReviewAsset({
  asset,
  onSelectAsset,
  ...props
}: Props & { asset: Asset; onSelectAsset: (id: string) => void }) {
  const latest = latestVersion(asset);
  const [versionId, setVersionId] = useState(latest.id);
  const version = asset.versions.find((v) => v.id === versionId) ?? latest;
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<"select" | "comment" | "pan">("comment");
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [body, setBody] = useState("");
  const [guestName, setGuestName] = useState("");
  const [busy, setBusy] = useState(false);
  const [compare, setCompare] = useState(false);
  const [mobileComments, setMobileComments] = useState(false);
  const [filter, setFilter] = useState("open");
  const [selected, setSelected] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [imageNonce, setImageNonce] = useState(0);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const toast = useToast();
  const comments = props.comments.filter((c) => c.versionId === version.id);
  const roots = comments.filter((c) => !c.parentId);
  const open = roots.filter((c) => !c.resolved);
  const pins = roots.filter((c) => c.x !== null && c.y !== null);
  const visible = roots.filter(
    (c) => filter === "all" || (filter === "resolved" ? c.resolved : !c.resolved),
  );
  const isLatest = version.id === latest.id;
  const onClose = props.onClose;

  useEffect(() => {
    setVersionId(latest.id);
    setPending(null);
    setReplyTo(null);
  }, [latest.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.querySelector("[data-proofly-modal]")) return;
      if ((e.target as HTMLElement)?.matches("input, textarea, select")) return;
      if (e.key === "Escape" && !compare) onClose();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(3, z + 0.25));
      if (e.key === "-") setZoom((z) => Math.max(0.5, z - 0.25));
      if (e.key === "0") setZoom(1);
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, [compare, onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.setProperty("overflow", "hidden");
    panel.current?.focus();
    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab" || document.querySelector("[data-proofly-modal]")) return;
      const targets = [
        ...(panel.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], input:not([disabled]), textarea, select",
        ) ?? []),
      ].filter((el) => el.getClientRects().length > 0);
      if (!targets.length) return;
      const first = targets[0],
        last = targets[targets.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === panel.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last || document.activeElement === panel.current)
      ) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      document.body.style.setProperty("overflow", overflow);
      previous?.focus();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await props.onComment(version.id, {
        body: body.trim(),
        x: pending?.x ?? null,
        y: pending?.y ?? null,
        parentId: replyTo,
        authorName: props.guest ? guestName.trim() : undefined,
      });
      setBody("");
      setPending(null);
      setReplyTo(null);
      setFilter("open");
    } catch (error) {
      toast((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function decide(decision: Decision) {
    if (props.guest && guestName.trim().length < 2) {
      toast("Add your name above before making a review decision.", true);
      return;
    }
    setBusy(true);
    try {
      await props.onDecision(version.id, decision, props.guest ? guestName.trim() : undefined);
      toast(
        decision === "approved"
          ? "This version is approved. Looking good!"
          : "Changes requested for this version.",
      );
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  function selectComment(id: string) {
    setSelected(id);
    setFilter("all");
    setMobileComments(true);
    setTimeout(
      () =>
        document
          .getElementById(`thread-${id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      60,
    );
  }

  return (
    <section
      ref={panel}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label={`Review ${asset.name}`}
      className="fixed inset-0 z-40 flex h-dvh flex-col bg-paper outline-none animate-enter"
    >
      <header className="flex min-h-17 items-center gap-3 border-b border-line bg-surface px-3 sm:px-5">
        <IconButton label="Back to projects" onClick={props.onClose}>
          <ArrowLeft className="size-4" />
        </IconButton>
        <span className="hidden h-6 w-px bg-line sm:block" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{asset.name}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted">
            {props.project.client} <span className="mx-1.5">/</span> {props.project.name}
          </p>
        </div>
        <Select
          aria-label="Asset version"
          value={version.id}
          onChange={(e) => {
            setVersionId(e.target.value);
            setPending(null);
            setReplyTo(null);
            setImageError(false);
          }}
        >
          {[...asset.versions]
            .sort((a, b) => b.number - a.number)
            .map((v) => (
              <option key={v.id} value={v.id}>
                Version {v.number}
                {v.id === latest.id ? " · Latest" : ""}
              </option>
            ))}
        </Select>
        <span className="hidden items-center gap-1.5 rounded-full bg-subtle px-3 py-1.5 text-[11px] text-muted md:inline-flex">
          <span
            className={`size-1.5 rounded-full ${version.decision === "approved" ? "bg-green-500" : "bg-amber-500"}`}
          />
          {decisionLabel[version.decision]}
        </span>
        <IconButton
          label="Compare versions"
          disabled={asset.versions.length < 2}
          onClick={() => setCompare(true)}
        >
          <Columns2 className="size-4" />
        </IconButton>
        <a
          href={`${version.previewUrl}${version.previewUrl.includes("?") ? "&" : "?"}download=1`}
          download={`${asset.name}-v${version.number}`}
          aria-label="Download this version"
          className="hidden size-9 items-center justify-center rounded-lg text-muted hover:bg-subtle sm:flex"
        >
          <Download className="size-4" />
        </a>
        {props.onUpload && props.canEdit && (
          <Button
            variant="secondary"
            className="hidden md:flex"
            onClick={() => props.onUpload?.(asset.id)}
          >
            <Upload className="size-3.5" />
            New version
          </Button>
        )}
        <IconButton
          label="Toggle feedback panel"
          className="lg:hidden"
          onClick={() => setMobileComments(!mobileComments)}
        >
          <MessageCircle className="size-4" />
        </IconButton>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-11 items-center justify-between gap-2 border-b border-line bg-surface/70 px-4 text-[11px] text-muted">
            <span>
              {version.width} × {version.height} <span className="mx-2 opacity-50">·</span>
              {formatBytes(version.byteSize)}
            </span>
            <span className="hidden sm:block">
              {tool === "comment" && props.allowComments !== false
                ? "Click anywhere on the design to leave feedback"
                : tool === "pan"
                  ? "Drag to move around the canvas"
                  : "Use the toolbar to explore the design"}
            </span>
            <span>{isLatest ? "Latest version" : "Previous version"}</span>
          </div>
          <div
            ref={stage}
            className="canvas-grid relative flex-1 overflow-auto bg-[#eeede9] dark:bg-[#17181b]"
            onPointerDown={(e) => {
              if (tool === "pan" && stage.current) {
                drag.current = {
                  x: e.clientX,
                  y: e.clientY,
                  left: stage.current.scrollLeft,
                  top: stage.current.scrollTop,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }
            }}
            onPointerMove={(e) => {
              if (drag.current && stage.current) {
                stage.current.scrollLeft = drag.current.left - e.clientX + drag.current.x;
                stage.current.scrollTop = drag.current.top - e.clientY + drag.current.y;
              }
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <div
              className="flex min-h-full min-w-full items-center justify-center px-6 pt-10 pb-24 sm:px-12"
              style={{
                minWidth: zoom > 1 ? `${zoom * 100}%` : "100%",
                cursor: tool === "pan" ? "grab" : "default",
              }}
            >
              <div
                className="relative shrink-0 shadow-[0_12px_60px_#00000015] transition-[width] duration-150"
                style={{
                  width: `${Math.min(100, zoom * 100)}%`,
                  maxWidth: `${860 * zoom}px`,
                  aspectRatio: `${version.width}/${version.height}`,
                  cursor:
                    tool === "comment" && props.allowComments !== false ? "crosshair" : "inherit",
                }}
                onClick={(e) => {
                  if (
                    tool !== "comment" ||
                    props.allowComments === false ||
                    imageError ||
                    (e.target as HTMLElement).closest("button")
                  )
                    return;
                  const r = e.currentTarget.getBoundingClientRect();
                  setPending({
                    x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
                    y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
                  });
                  setReplyTo(null);
                  setMobileComments(true);
                  textarea.current?.focus();
                }}
              >
                {imageError ? (
                  <div className="flex h-full min-h-60 flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
                    <p className="text-sm text-muted">
                      This preview couldn’t load. Its link may have expired.
                    </p>
                    <Button
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageError(false);
                        setImageNonce((n) => n + 1);
                      }}
                    >
                      Retry preview
                    </Button>
                  </div>
                ) : (
                  <img
                    key={`${version.id}-${imageNonce}`}
                    src={`${version.previewUrl}${imageNonce ? `${version.previewUrl.includes("?") ? "&" : "?"}retry=${imageNonce}` : ""}`}
                    alt={`${asset.name}, version ${version.number}`}
                    width={version.width}
                    height={version.height}
                    draggable={false}
                    onError={() => setImageError(true)}
                    className="block h-full w-full select-none object-contain"
                  />
                )}
                {pins.map((c, i) => (
                  <button
                    key={c.id}
                    aria-label={`Read comment ${i + 1} by ${c.authorName}`}
                    onClick={() => selectComment(c.id)}
                    style={{ left: `${c.x! * 100}%`, top: `${c.y! * 100}%` }}
                    className={`absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full rounded-bl-sm text-xs font-bold text-white shadow-md ring-[3px] ring-white transition hover:scale-110 ${c.resolved ? "bg-[#7d916b]" : "bg-accent"} ${selected === c.id ? "scale-115 outline-2 outline-offset-4 outline-accent" : ""}`}
                  >
                    {c.resolved ? <Check className="size-4" /> : i + 1}
                  </button>
                ))}
                {pending && (
                  <span
                    style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%` }}
                    className="absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full rounded-bl-sm bg-ink text-surface shadow-lg ring-[3px] ring-white"
                  >
                    <Plus className="size-4" />
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-2xl border border-line bg-surface p-1.5 shadow-lg">
            {(
              [
                { value: "select", icon: MousePointer2, label: "Select tool" },
                { value: "comment", icon: MessageCircle, label: "Pin a comment" },
                { value: "pan", icon: Hand, label: "Pan canvas" },
              ] as const
            ).map((t) => (
              <IconButton
                key={t.value}
                label={t.label}
                disabled={t.value === "comment" && props.allowComments === false}
                className={tool === t.value ? "bg-accent-soft text-accent" : ""}
                onClick={() => setTool(t.value)}
              >
                <t.icon className="size-4" />
              </IconButton>
            ))}
            <span className="mx-1 h-5 w-px bg-line" />
            <IconButton
              label="Zoom out"
              disabled={zoom <= 0.5}
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            >
              <Minus className="size-4" />
            </IconButton>
            <button
              className="min-w-12 px-1 text-xs text-muted"
              title="Reset zoom"
              onClick={() => setZoom(1)}
            >
              {Math.round(zoom * 100)}%
            </button>
            <IconButton
              label="Zoom in"
              disabled={zoom >= 3}
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            >
              <Plus className="size-4" />
            </IconButton>
          </div>
          {props.assets.length > 1 && (
            <div className="flex shrink-0 items-center gap-3 overflow-x-auto border-t border-line bg-surface px-4 py-3">
              {props.assets.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onSelectAsset(a.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg border p-1.5 pr-3 text-xs ${a.id === asset.id ? "border-accent bg-accent-soft" : "border-line text-muted"}`}
                >
                  <img
                    src={latestVersion(a).previewUrl}
                    alt=""
                    className="h-9 w-12 rounded object-cover"
                  />
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <aside
          className={`${mobileComments ? "absolute inset-y-17 right-0 z-20 flex w-[min(360px,92vw)] shadow-2xl" : "hidden w-[350px] lg:flex"} flex-col border-l border-line bg-surface`}
          aria-label="Feedback"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              Feedback{" "}
              <span className="rounded-md bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-muted">
                {roots.length}
              </span>
            </h2>
            <IconButton
              label="Hide feedback"
              onClick={() => setMobileComments(false)}
              className="lg:hidden"
            >
              <X className="size-4" />
            </IconButton>
            <Select
              aria-label="Filter feedback"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="open">Open ({open.length})</option>
              <option value="resolved">Resolved ({roots.length - open.length})</option>
              <option value="all">All feedback</option>
            </Select>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {!visible.length && (
              <div className="px-4 py-12 text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-subtle">
                  <MessageCircle className="size-5 text-muted" />
                </div>
                <p className="text-sm font-medium">
                  {filter === "resolved"
                    ? "Nothing resolved yet"
                    : "A little feedback goes a long way"}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {filter === "resolved"
                    ? "Resolved conversations will appear here."
                    : "Click on the design to pin your thoughts, or leave a general comment below."}
                </p>
              </div>
            )}
            {visible.map((c) => (
              <article
                key={c.id}
                id={`thread-${c.id}`}
                className={`rounded-xl border p-3.5 transition ${selected === c.id ? "border-accent/45 bg-accent-soft/40" : "border-line"}`}
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={c.authorName} size="sm" color={c.authorName.length % 4} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{c.authorName}</p>
                    <p className="mt-0.5 text-[10px] text-muted">{relativeTime(c.createdAt)}</p>
                  </div>
                  {c.x !== null && (
                    <button
                      aria-label="Locate comment on canvas"
                      className="rounded-md bg-subtle px-1.5 py-1 text-[10px] text-muted"
                      onClick={() => setSelected(c.id)}
                    >
                      #{pins.findIndex((p) => p.id === c.id) + 1}
                    </button>
                  )}
                  {props.canEdit && (
                    <IconButton
                      label={c.resolved ? "Reopen conversation" : "Resolve conversation"}
                      className={`size-7 ${c.resolved ? "text-green-600" : ""}`}
                      onClick={async () => {
                        try {
                          await props.onResolve(c.id, !c.resolved);
                        } catch (e) {
                          toast((e as Error).message, true);
                        }
                      }}
                    >
                      <Check className="size-3.5" />
                    </IconButton>
                  )}
                </div>
                <p className="mt-3 text-[12px] leading-[1.8] whitespace-pre-wrap break-words text-ink/85">
                  {c.body}
                </p>
                {comments
                  .filter((r) => r.parentId === c.id)
                  .map((r) => (
                    <div key={r.id} className="mt-3 border-t border-line pt-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={r.authorName} size="sm" />
                        <span className="text-[11px] font-semibold">{r.authorName}</span>
                        <span className="ml-auto text-[10px] text-muted">
                          {relativeTime(r.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed whitespace-pre-wrap break-words text-muted">
                        {r.body}
                      </p>
                    </div>
                  ))}
                {props.allowComments !== false && (
                  <button
                    className="mt-3 text-[11px] text-muted hover:text-accent"
                    onClick={() => {
                      setReplyTo(c.id);
                      setPending(null);
                      textarea.current?.focus();
                    }}
                  >
                    Reply to thread
                  </button>
                )}
                {c.resolved && (
                  <p className="mt-2 flex items-center gap-1 text-[10px] text-green-600">
                    <CheckCheck className="size-3" />
                    Resolved
                  </p>
                )}
              </article>
            ))}
          </div>
          {props.allowComments !== false && (
            <form onSubmit={submit} className="shrink-0 border-t border-line p-4">
              {(pending || replyTo) && (
                <div className="mb-2 flex items-center justify-between text-[11px] text-accent">
                  <span>
                    {replyTo ? "Replying to conversation" : "Comment pinned to the design"}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove comment location or reply"
                    onClick={() => {
                      setPending(null);
                      setReplyTo(null);
                    }}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )}
              {props.guest && (
                <input
                  aria-label="Your name"
                  required
                  maxLength={80}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Your name"
                  className={`${inputClass} mb-2 min-h-9 py-2 text-xs`}
                />
              )}
              <div className="rounded-xl border border-line bg-paper p-2">
                <textarea
                  ref={textarea}
                  aria-label={replyTo ? "Your reply" : "Your feedback"}
                  required
                  maxLength={4000}
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={replyTo ? "Keep the conversation going…" : "What are your thoughts?"}
                  className="w-full resize-none bg-transparent px-1 pt-1 text-xs leading-relaxed outline-none placeholder:text-muted"
                />
                <div className="flex items-center justify-between">
                  <span className="px-1 text-[10px] text-muted">Kind words. Clear feedback.</span>
                  <Button
                    type="submit"
                    loading={busy}
                    disabled={!body.trim() || (props.guest && !guestName.trim())}
                    className="min-h-8 rounded-lg px-2.5 py-1.5 text-[11px]"
                  >
                    <Send className="size-3" />
                    Send
                  </Button>
                </div>
              </div>
            </form>
          )}
          {(props.canDecide ?? props.canEdit) && isLatest && (
            <div className="border-t border-line bg-paper p-4">
              <p className="mb-3 text-[11px] text-muted">
                {version.decision === "approved"
                  ? "Approved. Ready for the next chapter."
                  : "Ready to move this version forward?"}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="min-h-9 flex-1 px-2 text-[11px]"
                  loading={busy}
                  disabled={version.decision === "changes_requested"}
                  onClick={() => decide("changes_requested")}
                >
                  Request changes
                </Button>
                <Button
                  className="min-h-9 flex-1 bg-[#5d7657] px-2 text-[11px] text-white"
                  loading={busy}
                  disabled={version.decision === "approved"}
                  onClick={() => decide("approved")}
                >
                  <Check className="size-3.5" />
                  {version.decision === "approved" ? "Approved" : "Approve"}
                </Button>
              </div>
            </div>
          )}
          {!props.canEdit && (
            <div className="border-t border-line p-4 text-[11px] leading-relaxed text-muted">
              {props.guest
                ? "You’re reviewing a shared project. Your feedback stays with this version."
                : "You have view access to this workspace."}
            </div>
          )}
        </aside>
      </div>
      {compare && <CompareModal asset={asset} onClose={() => setCompare(false)} />}
    </section>
  );
}

function CompareModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const versions = [...asset.versions].sort((a, b) => b.number - a.number);
  const [left, setLeft] = useState<AssetVersion>(versions[1]);
  const [right, setRight] = useState<AssetVersion>(versions[0]);
  const [position, setPosition] = useState(50);
  const [sideBySide, setSideBySide] = useState(false);
  return (
    <Modal
      title="A fresh perspective"
      subtitle="See exactly what changed between versions."
      wide
      onClose={onClose}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Select
          aria-label="Before version"
          value={left.id}
          onChange={(e) => setLeft(versions.find((v) => v.id === e.target.value)!)}
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              Before · Version {v.number}
            </option>
          ))}
        </Select>
        <Button
          variant="ghost"
          onClick={() => setSideBySide(!sideBySide)}
          className="min-h-8 text-xs"
        >
          <Columns2 className="size-3.5" />
          {sideBySide ? "Slider view" : "Side by side"}
        </Button>
        <Select
          aria-label="After version"
          value={right.id}
          onChange={(e) => setRight(versions.find((v) => v.id === e.target.value)!)}
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              After · Version {v.number}
            </option>
          ))}
        </Select>
      </div>
      {sideBySide ? (
        <div className="grid grid-cols-2 gap-2">
          <img src={left.previewUrl} alt={`Version ${left.number}`} className="w-full rounded-lg" />
          <img
            src={right.previewUrl}
            alt={`Version ${right.number}`}
            className="w-full rounded-lg"
          />
        </div>
      ) : (
        <div
          className="relative overflow-hidden rounded-xl bg-subtle"
          style={{ aspectRatio: `${right.width}/${right.height}` }}
        >
          <img
            src={right.previewUrl}
            alt={`After: version ${right.number}`}
            className="absolute inset-0 size-full object-contain"
          />
          <img
            src={left.previewUrl}
            alt={`Before: version ${left.number}`}
            className="absolute inset-0 size-full object-contain"
            style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow"
            style={{ left: `${position}%` }}
          >
            <span className="absolute top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#333] shadow">
              <ChevronDown className="size-4 rotate-90" />
              <ChevronDown className="-ml-2 size-4 -rotate-90" />
            </span>
          </div>
        </div>
      )}
      {!sideBySide && (
        <label className="mt-5 block text-xs text-muted">
          Drag to compare
          <input
            type="range"
            min="0"
            max="100"
            value={position}
            aria-label="Version comparison slider"
            onChange={(e) => setPosition(Number(e.target.value))}
            className="mt-3 w-full accent-[#e66746]"
          />
        </label>
      )}
      {left.width / left.height !== right.width / right.height && (
        <p className="mt-3 text-xs text-muted">
          These versions have different proportions. Side-by-side view preserves both layouts.
        </p>
      )}
    </Modal>
  );
}
