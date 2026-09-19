import type { ButtonHTMLAttributes } from "react";

type Tone = "paper" | "coral" | "violet" | "teal" | "yellow" | "sky" | "ink" | "grey";
type Size = "sm" | "md" | "lg";

const TONE: Record<Tone, string> = {
  paper: "bg-paper text-ink",
  coral: "bg-coral text-ink",
  violet: "bg-violet text-ink",
  teal: "bg-teal text-ink",
  yellow: "bg-yellow text-ink",
  sky: "bg-sky text-ink",
  ink: "bg-ink text-cream",
  grey: "bg-grey text-ink",
};

const SIZE: Record<Size, string> = {
  sm: "text-[13px] px-3 py-2 rounded-[10px]",
  md: "text-[15px] px-4 py-3 rounded-[var(--r-btn)]",
  lg: "text-[17px] px-5 py-4 rounded-[14px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  size?: Size;
  block?: boolean;
}

export function Button({ tone = "paper", size = "md", block = false, className = "", type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`brut pressable inline-flex items-center justify-center gap-2 font-extrabold leading-none ${TONE[tone]} ${SIZE[size]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    />
  );
}
