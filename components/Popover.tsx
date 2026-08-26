"use client";

import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface PopoverProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  width?: number;
  className?: string;
}

export function Popover({
  trigger,
  children,
  align = "start",
  width = 220,
  className,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  const reposition = useCallback(() => {
    const wrap = triggerRef.current;
    if (!wrap) return;
    // The wrapper uses `display: contents` (no box of its own), so measure the
    // actual trigger element instead — a contents node reports an empty rect.
    const el = (wrap.firstElementChild as HTMLElement | null) ?? wrap;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = align === "end" ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, vw - width - 8));
    // estimate panel height, flip if needed
    const panelH = panelRef.current?.offsetHeight ?? 280;
    let top = r.bottom + 6;
    if (top + panelH > vh - 8) {
      top = Math.max(8, r.top - panelH - 6);
    }
    setPos({ top, left });
  }, [align, width]);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => reposition();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onClick = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      )
        return;
      close();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, close, reposition]);

  return (
    <>
      <div ref={triggerRef} className="contents">
        {trigger({ open, toggle })}
      </div>
      {open &&
        mounted &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: pos.top, left: pos.left, width }}
            className={cn(
              "fixed z-50 overflow-hidden rounded-xl border border-border bg-surface shadow-pop animate-scale-in",
              className
            )}
          >
            {children(close)}
          </div>,
          document.body
        )}
    </>
  );
}

export function MenuItem({
  children,
  onClick,
  active,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm text-fg transition-colors hover:bg-surface-2",
        active && "bg-surface-2",
        className
      )}
    >
      {children}
    </button>
  );
}
