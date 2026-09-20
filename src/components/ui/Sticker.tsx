/**
 * Sparse decoration. Stickers live in the cream gutter: beside a screen title or in the page
 * foot. They are anchored to a stable element (never a pixel offset inside a card stack), so
 * they cannot land on a card or on data whatever the content length.
 */
type Kind = "star" | "squiggle" | "square" | "dot" | "sparkle" | "tally";
type Tone = "coral" | "violet" | "teal" | "yellow" | "sky" | "orange";

const FILL: Record<Tone, string> = {
  coral: "var(--coral)",
  violet: "var(--violet)",
  teal: "var(--teal)",
  yellow: "var(--yellow)",
  sky: "var(--sky)",
  orange: "var(--orange)",
};

export function Sticker({ kind, tone, size = 22, className = "", rotate = 0, inline = false }: { kind: Kind; tone: Tone; size?: number; className?: string; rotate?: number; inline?: boolean }) {
  const fill = FILL[tone];
  const common = {
    style: { transform: `rotate(${rotate}deg)` },
    "aria-hidden": true as const,
    className: `pointer-events-none shrink-0 ${inline ? "" : "absolute"} ${className}`,
  };
  switch (kind) {
    case "star":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
          <path d="M12 2l2.6 6.2 6.7.6-5.1 4.4 1.6 6.6L12 16.3 6.2 19.8l1.6-6.6L2.7 8.8l6.7-.6z" fill={fill} stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case "sparkle":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
          <path d="M12 2c.8 5.2 2.8 7.2 8 8-5.2.8-7.2 2.8-8 8-.8-5.2-2.8-7.2-8-8 5.2-.8 7.2-2.8 8-8z" transform="translate(0 2)" fill={fill} stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case "squiggle":
      return (
        <svg viewBox="0 0 48 16" width={size * 2} height={size * 0.7} {...common}>
          <path d="M2 10c5-8 9-8 14 0s9 8 14 0 9-8 14 0" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "tally":
      return (
        <svg viewBox="0 0 28 24" width={size * 1.15} height={size} {...common}>
          <g stroke="var(--ink)" strokeWidth="3" strokeLinecap="round">
            <path d="M5 4v16M11 4v16M17 4v16M23 4v16M2 18L26 6" />
          </g>
        </svg>
      );
    case "square":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
          <rect x="4" y="4" width="16" height="16" rx="3" fill={fill} stroke="var(--ink)" strokeWidth="2" />
        </svg>
      );
    case "dot":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
          <circle cx="12" cy="12" r="8" fill={fill} stroke="var(--ink)" strokeWidth="2" />
        </svg>
      );
  }
}

/** Two stickers closing a page in the cream below the last card. In flow, so they never overlap anything. */
export function PageFoot({ children }: { children: React.ReactNode }) {
  return (
    <div aria-hidden className="mt-5 flex items-center justify-center gap-4">
      {children}
    </div>
  );
}
