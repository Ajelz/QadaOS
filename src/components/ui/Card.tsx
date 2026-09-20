import type { HTMLAttributes, ReactNode } from "react";

type Tone = "paper" | "coral" | "violet" | "teal" | "yellow" | "sky" | "pink" | "orange" | "ink";

const TONE: Record<Tone, string> = {
  paper: "bg-paper",
  coral: "bg-coral",
  violet: "bg-violet",
  teal: "bg-teal",
  yellow: "bg-yellow",
  sky: "bg-sky",
  pink: "bg-pink",
  orange: "bg-orange",
  ink: "bg-ink text-cream",
};

/**
 * `padded={false}` is a prop, not a `px-0` override: two utilities of equal specificity
 * resolve by stylesheet order, which would silently keep the padding.
 * The right padding is 4px larger so a right-aligned control's hard shadow stays inside the gutter.
 */
export function Card({ tone = "paper", padded = true, className = "", ...rest }: HTMLAttributes<HTMLDivElement> & { tone?: Tone; padded?: boolean }) {
  return <div className={`brut ${TONE[tone]} rounded-[var(--r-card)] ${padded ? "py-3 pl-4 pr-5" : "overflow-hidden"} ${className}`} {...rest} />;
}

export function CardTitle({ className = "", ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={`text-[15px] font-black leading-tight tracking-[-0.01em] ${className}`} {...rest} />;
}

/** A card with an ink header bar. Used where a screen is a stack of sections (Settings). */
export function SectionCard({ title, children, tone = "paper", className = "" }: { title: string; children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <section className={`brut overflow-hidden rounded-[var(--r-card)] ${TONE[tone]} ${className}`}>
      <h2 className="border-b-[length:var(--bw)] border-ink bg-ink px-4 py-2 text-[13px] font-black tracking-[0.02em] text-cream">{title}</h2>
      <div className="py-2 pl-4 pr-5">{children}</div>
    </section>
  );
}
