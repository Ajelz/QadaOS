"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import { PRAYER_LABEL, type Prayer, type Rule, type Strategy } from "@/domain/types";

const KIND_LABEL: Record<Rule["kind"], string> = { with_daily: "After a daily prayer", block: "A set block", daily_quota: "A daily total" };

function PrayerSelect({ value, onChange, prayers, extra, label }: { value: string; onChange: (v: string) => void; prayers: Prayer[]; extra: { value: string; label: string }[]; label: string }) {
  return (
    <select aria-label={label} className="min-w-0 max-w-full flex-1 basis-[9rem]" value={value} onChange={(e) => onChange(e.target.value)}>
      {extra.map((x) => (
        <option key={x.value} value={x.value}>
          {x.label}
        </option>
      ))}
      {prayers.map((p) => (
        <option key={p} value={p}>
          {PRAYER_LABEL[p]}
        </option>
      ))}
    </select>
  );
}

/** The editor owns its draft and its sheet, so Save can be pinned to the sheet footer and always reachable. */
export function StrategyEditorSheet({ initial, prayers, isEdit, onSave, onClose }: { initial: Strategy | null; prayers: Prayer[]; isEdit: boolean; onSave: (s: Strategy) => void; onClose: () => void }) {
  if (!initial) return null;
  return <Editor key={initial.strategyId} initial={initial} prayers={prayers} isEdit={isEdit} onSave={onSave} onClose={onClose} />;
}

function Editor({ initial, prayers, isEdit, onSave, onClose }: { initial: Strategy; prayers: Prayer[]; isEdit: boolean; onSave: (s: Strategy) => void; onClose: () => void }) {
  const [name, setName] = useState(initial.name);
  const [rules, setRules] = useState<Rule[]>(initial.rules);
  const [order, setOrder] = useState<Prayer[]>(initial.order.filter((p) => prayers.includes(p)).concat(prayers.filter((p) => !initial.order.includes(p))));

  function update(i: number, patch: Partial<Rule>) {
    setRules((rs) => rs.map((r, j) => (j === i ? ({ ...r, ...patch } as Rule) : r)));
  }
  function add(kind: Rule["kind"]) {
    const r: Rule =
      kind === "with_daily" ? { kind, daily: "fajr", qada: "same", count: 1 } : kind === "block" ? { kind, label: "Tonight", after: "isha", qada: "next_in_order", count: 3 } : { kind, qada: "next_in_order", count: 5 };
    setRules((rs) => [...rs, r]);
  }
  function move(p: Prayer, dir: -1 | 1) {
    setOrder((o) => {
      const i = o.indexOf(p);
      const j = i + dir;
      if (j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const problem = name.trim().length === 0 ? "Give the plan a name." : rules.length === 0 ? "Add at least one rule." : rules.some((r) => r.kind === "block" && r.label.trim().length === 0) ? "Give every block a label." : null;
  const usesOrder = rules.some((r) => r.qada === "next_in_order");
  const nextOption = { value: "next_in_order", label: "whichever is next in my order" };

  return (
    <Sheet
      open
      onClose={onClose}
      title={isEdit ? "Edit plan" : "New plan"}
      footer={
        <>
          {problem && (
            <p role="status" className="mb-2 text-[13px] font-bold">
              {problem}
            </p>
          )}
          <div className="flex gap-3">
            <Button block onClick={onClose}>
              Cancel
            </Button>
            <Button block tone="coral" disabled={Boolean(problem)} onClick={() => onSave({ ...initial, name: name.trim(), rules, order })}>
              {isEdit ? "Save" : "Start plan"}
            </Button>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-black">Plan name</span>
          <input id="strategy-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="w-full" />
        </label>

        <section>
          <h3 className="mb-1.5 text-[13px] font-black">Rules</h3>
          <p className="mb-2 text-[13px] font-semibold text-mute">Each rule adds to your daily target. Combine as many as you like.</p>
          <div className="flex flex-col gap-3">
            {rules.map((r, i) => (
              <div key={i} className="brut-flat rounded-[var(--r-sm)] p-3">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <Chip tone="violet">{KIND_LABEL[r.kind]}</Chip>
                  <IconButton icon="close" label={`Remove rule ${i + 1}`} flat onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))} />
                </div>
                {r.kind === "block" && (
                  <label className="mb-2.5 flex flex-col gap-1.5">
                    <span className="text-[13px] font-bold">Label</span>
                    <input value={r.label} maxLength={40} onChange={(e) => update(i, { label: e.target.value })} placeholder="Tonight" className="w-full" />
                  </label>
                )}
                <div className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
                  <span>Make up</span>
                  <input type="number" inputMode="numeric" min={1} max={999} aria-label="How many" className="w-[76px]" value={r.count} onChange={(e) => update(i, { count: Math.min(999, Math.max(1, Math.trunc(Number(e.target.value)) || 1)) })} />
                  {r.kind === "with_daily" && (
                    <>
                      <PrayerSelect label="Which prayer to make up" value={r.qada} onChange={(v) => update(i, { qada: v as Rule["qada"] })} prayers={prayers} extra={[{ value: "same", label: "of that same prayer" }, nextOption]} />
                      <span>after each daily</span>
                      <PrayerSelect label="After which daily prayer" value={r.daily} onChange={(v) => update(i, { daily: v as Prayer })} prayers={prayers} extra={[]} />
                    </>
                  )}
                  {r.kind === "block" && (
                    <>
                      <PrayerSelect label="Which prayer to make up" value={r.qada} onChange={(v) => update(i, { qada: v as Prayer | "next_in_order" })} prayers={prayers} extra={[nextOption]} />
                      <span>after</span>
                      <PrayerSelect label="When" value={r.after} onChange={(v) => update(i, { after: v as Prayer | "any" })} prayers={prayers} extra={[{ value: "any", label: "any time of day" }]} />
                    </>
                  )}
                  {r.kind === "daily_quota" && (
                    <>
                      <PrayerSelect label="Which prayer to make up" value={r.qada} onChange={(v) => update(i, { qada: v as Prayer | "next_in_order" })} prayers={prayers} extra={[nextOption]} />
                      <span>every day</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 min-[400px]:grid-cols-3">
            <Button size="sm" onClick={() => add("with_daily")}>
              + After a prayer
            </Button>
            <Button size="sm" onClick={() => add("block")}>
              + A set block
            </Button>
            <Button size="sm" onClick={() => add("daily_quota")}>
              + A daily total
            </Button>
          </div>
        </section>

        {usesOrder && (
          <section>
            <h3 className="mb-1.5 text-[13px] font-black">Your order</h3>
            <p className="mb-2 text-[13px] font-semibold text-mute">&ldquo;Whichever is next&rdquo; means the first prayer in this list that you still owe. When it clears, the plan moves down.</p>
            <ol className="brut-flat overflow-hidden rounded-[var(--r-sm)]">
              {order.map((p, i) => (
                <li key={p} className={`flex items-center justify-between gap-2 py-1 pl-3 pr-1 ${i > 0 ? "border-t-[length:var(--bw)] border-ink" : ""}`}>
                  <span className="text-[15px] font-extrabold">
                    <span className="num mr-2 text-mute">{i + 1}</span>
                    {PRAYER_LABEL[p]}
                  </span>
                  <span className="flex gap-1">
                    <IconButton icon="up" label={`Move ${PRAYER_LABEL[p]} up`} flat disabled={i === 0} onClick={() => move(p, -1)} />
                    <IconButton icon="down" label={`Move ${PRAYER_LABEL[p]} down`} flat disabled={i === order.length - 1} onClick={() => move(p, 1)} />
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {isEdit && <p className="text-[13px] font-semibold text-mute">Saving closes the current period and starts a new one, so each version of your plan keeps its own report. Nothing you have logged changes.</p>}
      </div>
    </Sheet>
  );
}
