"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { PRAYER_LABEL, type Prayer, type Rule, type Strategy } from "@/domain/types";

const selectCls = "brut-sm rounded-[8px] bg-paper px-2 py-1.5 text-[13px] font-bold";
const inputCls = "brut-sm rounded-[8px] bg-paper px-2 py-1.5 text-[13px] font-bold w-full";

function PrayerSelect({ value, onChange, prayers, extra }: { value: string; onChange: (v: string) => void; prayers: Prayer[]; extra: { value: string; label: string }[] }) {
  return (
    <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>
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

export function StrategyEditor({ initial, prayers, onSave, onCancel }: { initial: Strategy; prayers: Prayer[]; onSave: (s: Strategy) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial.name);
  const [rules, setRules] = useState<Rule[]>(initial.rules);
  const [order, setOrder] = useState<Prayer[]>(initial.order.filter((p) => prayers.includes(p)).concat(prayers.filter((p) => !initial.order.includes(p))));

  function update(i: number, patch: Partial<Rule>) {
    setRules((rs) => rs.map((r, j) => (j === i ? ({ ...r, ...patch } as Rule) : r)));
  }
  function remove(i: number) {
    setRules((rs) => rs.filter((_, j) => j !== i));
  }
  function add(kind: Rule["kind"]) {
    const r: Rule =
      kind === "with_daily"
        ? { kind, daily: "fajr", qada: "same", count: 1 }
        : kind === "block"
          ? { kind, label: "Tonight", after: "isha", qada: "next_in_order", count: 3 }
          : { kind, qada: "next_in_order", count: 5 };
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

  const valid = name.trim().length > 0 && rules.length > 0 && rules.every((r) => r.count >= 1);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[12px] font-bold">
        Plan name
        <input id="strategy-name" className={inputCls} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </label>

      <div>
        <div className="mb-1.5 text-[12px] font-bold">Rules</div>
        <div className="flex flex-col gap-2">
          {rules.map((r, i) => (
            <div key={i} className="brut-flat rounded-[10px] p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <Chip tone="violet">{r.kind === "with_daily" ? "With a daily prayer" : r.kind === "block" ? "Block" : "Daily quota"}</Chip>
                <button type="button" onClick={() => remove(i)} className="text-[12px] font-extrabold underline">
                  Remove
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[13px] font-bold">
                <input type="number" min={1} max={999} className={`${selectCls} w-16`} value={r.count} onChange={(e) => update(i, { count: Math.max(1, Number(e.target.value) || 1) })} aria-label="Count" />
                {r.kind === "with_daily" && (
                  <>
                    <PrayerSelect
                      value={r.qada}
                      onChange={(v) => update(i, { qada: v as Rule["qada"] })}
                      prayers={prayers}
                      extra={[
                        { value: "same", label: "of the same prayer" },
                        { value: "next_in_order", label: "of next in order" },
                      ]}
                    />
                    <span>after daily</span>
                    <PrayerSelect value={r.daily} onChange={(v) => update(i, { daily: v as Prayer })} prayers={prayers} extra={[]} />
                  </>
                )}
                {r.kind === "block" && (
                  <>
                    <PrayerSelect value={r.qada} onChange={(v) => update(i, { qada: v as Prayer | "next_in_order" })} prayers={prayers} extra={[{ value: "next_in_order", label: "of next in order" }]} />
                    <span>after</span>
                    <PrayerSelect value={r.after} onChange={(v) => update(i, { after: v as Prayer | "any" })} prayers={prayers} extra={[{ value: "any", label: "any time" }]} />
                    <input className={`${selectCls} w-full`} value={r.label} maxLength={60} onChange={(e) => update(i, { label: e.target.value })} aria-label="Label" placeholder="Label, e.g. Tonight" />
                  </>
                )}
                {r.kind === "daily_quota" && (
                  <PrayerSelect value={r.qada} onChange={(v) => update(i, { qada: v as Prayer | "next_in_order" })} prayers={prayers} extra={[{ value: "next_in_order", label: "of next in order" }]} />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => add("with_daily")}>
            + With daily
          </Button>
          <Button size="sm" onClick={() => add("block")}>
            + Block
          </Button>
          <Button size="sm" onClick={() => add("daily_quota")}>
            + Quota
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[12px] font-bold">Order for &ldquo;next in order&rdquo;</div>
        <div className="flex flex-col gap-1.5">
          {order.map((p, i) => (
            <div key={p} className="brut-flat flex items-center justify-between rounded-[10px] px-2.5 py-1.5 text-[13px] font-bold">
              <span>
                {i + 1}. {PRAYER_LABEL[p]}
              </span>
              <span className="flex gap-1">
                <button type="button" aria-label={`Move ${PRAYER_LABEL[p]} up`} onClick={() => move(p, -1)} className="brut-sm pressable rounded-[6px] px-2 py-0.5">
                  ↑
                </button>
                <button type="button" aria-label={`Move ${PRAYER_LABEL[p]} down`} onClick={() => move(p, 1)} className="brut-sm pressable rounded-[6px] px-2 py-0.5">
                  ↓
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button block onClick={onCancel}>
          Cancel
        </Button>
        <Button block tone="violet" disabled={!valid} onClick={() => onSave({ ...initial, name: name.trim(), rules, order })}>
          Save plan
        </Button>
      </div>
    </div>
  );
}
