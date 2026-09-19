import type { HTMLAttributes } from "react";

type Tone = "paper" | "coral" | "violet" | "teal" | "yellow" | "sky" | "pink" | "orange";

const TONE: Record<Tone, string> = {
  paper: "bg-paper",
  coral: "bg-coral",
  violet: "bg-violet",
  teal: "bg-teal",
  yellow: "bg-yellow",
  sky: "bg-sky",
  pink: "bg-pink",
  orange: "bg-orange",
};

export function Card({ tone = "paper", className = "", ...rest }: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return <div className={`brut ${TONE[tone]} rounded-[var(--r-card)] px-4 py-3 ${className}`} {...rest} />;
}

export function CardTitle({ className = "", ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={`text-[13px] font-extrabold ${className}`} {...rest} />;
}
