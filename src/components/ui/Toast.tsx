"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export interface ToastInput {
  message: string;
  tone?: "paper" | "coral" | "teal" | "yellow";
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

const TONE = { paper: "bg-paper", coral: "bg-coral", teal: "bg-teal", yellow: "bg-yellow" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const show = useCallback(
    (t: ToastInput) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), t.durationMs ?? (t.action ? 6000 : 3200));
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)" }} aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`brut pointer-events-auto flex w-full max-w-[440px] items-center gap-3 rounded-[12px] px-3.5 py-2.5 text-[14px] font-bold ${TONE[t.tone ?? "paper"]}`}>
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="brut-sm pressable rounded-[8px] bg-yellow px-2.5 py-1.5 text-[12px] font-extrabold"
                onClick={() => {
                  void t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
