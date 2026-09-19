import type { HTMLAttributes } from "react";

type Tone = "paper" | "coral" | "violet" | "teal" | "yellow" | "sky" | "grey" | "ink";

const TONE: Record<Tone, string> = {
  paper: "bg-paper text-ink",
  coral: "bg-coral text-ink",
  violet: "bg-violet text-ink",
  teal: "bg-teal text-ink",
  yellow: "bg-yellow text-ink",
  sky: "bg-sky text-ink",
  grey: "bg-grey text-ink",
  ink: "bg-ink text-cream",
};

export function Chip({ tone = "paper", className = "", ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-2.5 py-1 text-[12px] font-bold leading-none ${TONE[tone]} ${className}`}
      {...rest}
    />
  );
}
