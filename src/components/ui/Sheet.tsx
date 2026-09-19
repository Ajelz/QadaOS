"use client";

import { useEffect, type ReactNode } from "react";

/** Bottom sheet. Hard-bordered, no backdrop blur, closes on scrim tap or Escape. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
      <button aria-label="Close" className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="brut relative w-full max-w-[480px] rounded-t-[20px] border-b-0 px-4 pt-3 safe-bottom"
        style={{ boxShadow: "0 -4px 0 var(--ink)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink" />
        <h2 className="mb-3 text-[17px] font-black tracking-tight">{title}</h2>
        {children}
      </div>
    </div>
  );
}
