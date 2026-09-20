/**
 * One icon set: 24px grid, 2.5px stroke, square caps and miter joins, to match the borders.
 * Decorative by default; the control that holds an icon carries the accessible name.
 */
export type IconName = "gear" | "back" | "up" | "down" | "check" | "minus" | "plus" | "undo" | "restore" | "close" | "chevron" | "calendar";

const PATHS: Record<IconName, React.ReactNode> = {
  // Sliders, not a cog: a cog turns into a sun at this stroke weight.
  gear: (
    <>
      <path d="M3 6h18M3 12h18M3 18h18" />
      <rect x="6.5" y="3.5" width="5" height="5" fill="var(--paper)" />
      <rect x="13.5" y="9.5" width="5" height="5" fill="var(--paper)" />
      <rect x="8.5" y="15.5" width="5" height="5" fill="var(--paper)" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  up: <path d="M5 15l7-7 7 7" />,
  down: <path d="M5 9l7 7 7-7" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  undo: <path d="M9 7L4 12l5 5M4 12h10a6 6 0 0 1 6 6" />,
  restore: <path d="M15 7l5 5-5 5M20 12H10a6 6 0 0 0-6 6" />,
  calendar: (
    <>
      <rect x="4" y="6" width="16" height="14" />
      <path d="M4 11h16M9 3v5M15 3v5" />
    </>
  ),
};

export function Icon({ name, size = 22, strokeWidth = 2.5, className = "" }: { name: IconName; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="square" strokeLinejoin="miter" aria-hidden className={className}>
      {PATHS[name]}
    </svg>
  );
}
