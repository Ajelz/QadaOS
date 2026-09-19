type Tone = "coral" | "violet" | "teal" | "yellow" | "sky" | "orange";

const TONE: Record<Tone, string> = {
  coral: "bg-coral",
  violet: "bg-violet",
  teal: "bg-teal",
  yellow: "bg-yellow",
  sky: "bg-sky",
  orange: "bg-orange",
};

export function ProgressBar({ value, tone, label }: { value: number; tone: Tone; label: string }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="brut-sm relative h-[22px] overflow-hidden rounded-full"
    >
      <div
        className={`absolute inset-y-0 left-0 ${TONE[tone]} ${pct > 0 && pct < 100 ? "border-r-[2.5px] border-ink" : ""}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
