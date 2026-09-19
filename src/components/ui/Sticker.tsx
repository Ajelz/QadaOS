/**
 * Sparse decoration for cream backgrounds only. Never on cards, never over data.
 * Positioned absolutely by the parent; at most three per screen.
 */
type Kind = "star" | "squiggle" | "square" | "dot";
type Tone = "coral" | "violet" | "teal" | "yellow" | "sky" | "orange";

const FILL: Record<Tone, string> = {
  coral: "var(--coral)",
  violet: "var(--violet)",
  teal: "var(--teal)",
  yellow: "var(--yellow)",
  sky: "var(--sky)",
  orange: "var(--orange)",
};

export function Sticker({ kind, tone, size = 22, className = "", rotate = 0 }: { kind: Kind; tone: Tone; size?: number; className?: string; rotate?: number }) {
  const fill = FILL[tone];
  const common = { width: size, height: size, style: { transform: `rotate(${rotate}deg)` }, "aria-hidden": true as const, className: `pointer-events-none absolute ${className}` };
  switch (kind) {
    case "star":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 2l2.6 6.2 6.7.6-5.1 4.4 1.6 6.6L12 16.3 6.2 19.8l1.6-6.6L2.7 8.8l6.7-.6z" fill={fill} stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case "squiggle":
      return (
        <svg viewBox="0 0 48 16" {...common} width={size * 2} height={size * 0.7}>
          <path d="M2 10c5-8 9-8 14 0s9 8 14 0 9-8 14 0" fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case "square":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="4" y="4" width="16" height="16" rx="3" fill={fill} stroke="var(--ink)" strokeWidth="2" />
        </svg>
      );
    case "dot":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="8" fill={fill} stroke="var(--ink)" strokeWidth="2" />
        </svg>
      );
  }
}
