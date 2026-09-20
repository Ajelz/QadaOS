"use client";

/** Two or three options in one pill. Looks interactive because it is shaped like a control. */
export function Segmented<T extends string>({ value, onChange, options, label, tone = "sky" }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; tone?: "sky" | "violet" | "yellow" }) {
  const fill = { sky: "bg-sky", violet: "bg-violet", yellow: "bg-yellow" }[tone];
  return (
    <div role="radiogroup" aria-label={label} className="brut-sm inline-flex overflow-hidden rounded-full">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-[44px] px-3.5 text-[13px] font-black ${i > 0 ? "border-l-[length:var(--bw)] border-ink" : ""} ${o.value === value ? fill : "bg-paper"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
