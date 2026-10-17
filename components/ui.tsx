"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { initials } from "@/lib/format";

export function Logo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Proofly home"
      className={`inline-flex items-center gap-2.5 ${light ? "text-white" : "text-ink"}`}
    >
      <svg className="size-8 shrink-0" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect width="40" height="40" rx="12" fill="#e66746" />
        <path d="M12 28V12h11a7 7 0 0 1 0 14h-5v-6h5a1 1 0 0 0 0-2h-5v10z" fill="#fff8ef" />
      </svg>
      {!compact && (
        <span className="text-[25px] leading-none font-bold tracking-[-.055em]">
          proofly<span className="text-accent">.</span>
        </span>
      )}
    </Link>
  );
}

export function Button({
  children,
  className = "",
  variant = "primary",
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}) {
  const colors = {
    primary: "bg-ink text-surface hover:opacity-85",
    secondary: "border border-line bg-surface text-ink hover:bg-subtle",
    ghost: "text-muted hover:bg-subtle hover:text-ink",
    danger: "bg-red-50 text-red-700 hover:bg-red-100",
  };
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium transition disabled:opacity-45 ${colors[variant]} ${className}`}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      title={label}
      aria-label={label}
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-subtle hover:text-ink disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function Avatar({
  name,
  size = "md",
  color = 0,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  color?: number;
}) {
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-surface ${size === "sm" ? "size-6 text-[9px]" : size === "lg" ? "size-10 text-[12px]" : "size-8 text-[10px]"} ${["bg-[#f3dfd1] text-[#865e43]", "bg-[#e0e5d5] text-[#5c6d4c]", "bg-[#e8def0] text-[#786088]", "bg-[#dce8ee] text-[#516b79]"][color % 4]}`}
    >
      {initials(name)}
    </span>
  );
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const elements = ref.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), textarea, select, [tabindex="0"]',
        );
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      data-proofly-modal
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`max-h-[90dvh] w-full overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl outline-none ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id={id} className="text-xl font-semibold tracking-tight">
              {title}
            </h2>
            {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-muted">{subtitle}</p>}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="mb-4 block text-[13px] font-medium">
      <span className="mb-2 block">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}
export const inputClass =
  "min-h-11 w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-muted outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10";

const ToastContext = createContext<(message: string, error?: boolean) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function notify(message: string, error = false) {
    setToast({ message, error });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4500);
  }
  return (
    <ToastContext.Provider value={notify}>
      {children}
      {toast && (
        <div
          role={toast.error ? "alert" : "status"}
          className="fixed right-5 bottom-5 left-5 z-[100] flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 text-sm shadow-xl sm:left-auto sm:max-w-md"
        >
          <span
            className={`flex size-6 shrink-0 items-center justify-center rounded-full ${toast.error ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}
          >
            {toast.error ? <X className="size-3.5" /> : <Check className="size-3.5" />}
          </span>
          {toast.message}
          <IconButton label="Dismiss notification" onClick={() => setToast(null)}>
            <X className="size-3.5" />
          </IconButton>
        </div>
      )}
    </ToastContext.Provider>
  );
}
export function useToast() {
  return useContext(ToastContext);
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  return (
    <IconButton
      label={dark ? "Use light theme" : "Use dark theme"}
      onClick={() => {
        const value = !dark;
        setDark(value);
        document.documentElement.classList.toggle("dark", value);
        localStorage.setItem("proofly-theme", value ? "dark" : "light");
      }}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </IconButton>
  );
}

export function Select({
  children,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`min-h-9 appearance-none rounded-lg border border-line bg-surface py-2 pr-8 pl-3 text-xs outline-none ${className}`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3 -translate-y-1/2 text-muted" />
    </div>
  );
}
