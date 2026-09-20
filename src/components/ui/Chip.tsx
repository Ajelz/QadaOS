import type { HTMLAttributes } from "react";

type Tone = "paper" | "coral" | "violet" | "teal" | "yellow" | "sky" | "grey" | "ink" | "orange" | "cream";

const TONE: Record<Tone, string> = {
  paper: "bg-paper text-ink",
  coral: "bg-coral text-ink",
  violet: "bg-violet text-ink",
  teal: "bg-teal text-ink",
  yellow: "bg-yellow text-ink",
  sky: "bg-sky text-ink",
  grey: "bg-grey text-ink",
  orange: "bg-orange text-ink",
  cream: "bg-cream text-ink",
  ink: "bg-ink text-cream",
};

/** Static chips are flat. `raised` adds the small shadow and is for chips that are tappable. */
export function Chip({ tone = "paper", raised = false, className = "", ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; raised?: boolean }) {
  return <span className={`chip ${raised ? "chip-raised" : ""} ${TONE[tone]} ${className}`} {...rest} />;
}
