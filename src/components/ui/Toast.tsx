"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export interface ToastInput {
  message: string;
  /** teal = done, paper = neutral fact, yellow = needs attention, ink = error. */
  tone?: "paper" | "teal" | "yellow" | "ink";
  action?: { label: string; onClick: () => unknown };
  durationMs?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

const Ctx = createContext<{ show: (t: ToastInput) => void } | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx.show;
}

const TONE = { paper: "bg-paper text-ink", teal: "bg-teal text-ink", yellow: "bg-yellow text-ink", ink: "bg-ink text-cream" };

/**
 * One toast at a time: a newer toast replaces the older one, so an Undo never hides under a
 * stack. Toasts with an action stay for 8 seconds. While a sheet is open the container moves
 * to the top of the screen (see `body[data-sheet-open]` below) so it cannot cover sheet controls.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setItem(null);
  }, []);

  const show = useCallback((t: ToastInput) => {
    const id = ++seq.current;
    if (timer.current) clearTimeout(timer.current);
    setItem({ ...t, id });
    timer.current = setTimeout(() => setItem((cur) => (cur?.id === id ? null : cur)), t.durationMs ?? (t.action ? 8000 : 3500));
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div data-toast-root className="toast-root pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" role="status" aria-live="polite" aria-atomic="true">
        {item && (
          <div key={item.id} className={`brut pointer-events-auto flex w-full max-w-[448px] items-center gap-3 rounded-[var(--r-btn)] py-2 pl-4 pr-2 text-[15px] font-extrabold ${TONE[item.tone ?? "paper"]}`}>
            <span className="min-w-0 flex-1 py-1.5">{item.message}</span>
            {item.action ? (
              <button
                type="button"
                className="brut-sm pressable min-h-[44px] shrink-0 rounded-[var(--r-sm)] bg-paper px-3.5 text-[13px] font-black text-ink"
                onClick={() => {
                  void item.action?.onClick();
                  dismiss();
                }}
              >
                {item.action.label}
              </button>
            ) : (
              <span className="w-2" />
            )}
          </div>
        )}
      </div>
      <style>{`
        .toast-root { bottom: calc(env(safe-area-inset-bottom, 0px) + 92px); }
        body[data-sheet-open] .toast-root { bottom: auto; top: calc(env(safe-area-inset-top, 0px) + 12px); }
        @media (min-width: 900px) { .toast-root { bottom: 24px; } }
      `}</style>
    </Ctx.Provider>
  );
}
