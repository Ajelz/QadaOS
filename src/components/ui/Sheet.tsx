"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet. Portalled to <body> so the rest of the page can be made inert while it is
 * open. Never taller than the screen: the header stays put and the body scrolls. Focus
 * moves in on open, is trapped while open, and returns to the trigger on close.
 */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  return createPortal(
    <SheetBody onClose={onClose} title={title} footer={footer}>
      {children}
    </SheetBody>,
    document.body,
  );
}

function SheetBody({ onClose, title, children, footer }: { onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const root = rootRef.current;
    const panel = panelRef.current;
    if (!root || !panel) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Everything else on the page is inert: no taps, no tab stops, hidden from screen readers.
    const others = [...document.body.children].filter((el) => el !== root && !el.hasAttribute("data-toast-root") && !["SCRIPT", "STYLE", "LINK"].includes(el.tagName));
    for (const el of others) el.setAttribute("inert", "");

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Toasts move to the top while a sheet is open so they never cover its controls.
    document.body.dataset.sheetOpen = "1";

    panel.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      delete document.body.dataset.sheetOpen;
      for (const el of others) el.removeAttribute("inert");
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
      <div className="scrim absolute inset-0" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex w-full max-w-[480px] flex-col rounded-t-[var(--r-card)] border-[length:var(--bw)] border-b-0 border-ink bg-paper outline-none"
        style={{ maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - 32px)" }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b-[length:var(--bw)] border-ink py-2.5 pl-4 pr-3">
          <h2 id={titleId} className="min-w-0 text-[17px] font-black leading-tight tracking-[-0.01em]">
            {title}
          </h2>
          <IconButton icon="close" label="Close" flat onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pl-4 pr-5 pt-4" style={{ paddingBottom: footer ? 16 : "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}>
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t-[length:var(--bw)] border-ink bg-paper pl-4 pr-5 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
