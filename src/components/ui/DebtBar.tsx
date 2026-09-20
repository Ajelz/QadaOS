/**
 * A per-prayer debt bar that DRAINS: the orange fill is what is still owed, the paper
 * on the right is what has been cleared. A new user sees full bars, never blank capsules,
 * and the first logged prayer is visible because a sliver is never narrower than 4%.
 */
export function DebtBar({ remaining, total, label }: { remaining: number; total: number; label: string }) {
  const base = Math.max(total, remaining, 0);
  const owed = Math.max(0, remaining);
  let pct = base > 0 ? (owed / base) * 100 : 0;
  if (owed > 0 && pct < 4) pct = 4;
  if (owed < base && pct > 96) pct = 96;
  const split = pct > 0 && pct < 100;
  return (
    <div role="img" aria-label={label} className="relative h-[22px] overflow-hidden rounded-full border-[length:var(--bw)] border-ink bg-paper">
      <div className={`absolute inset-y-0 left-0 bg-orange ${split ? "border-r-[length:var(--bw)] border-ink" : ""}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
