import type { ButtonHTMLAttributes } from "react";

export type ButtonTone = "paper" | "coral" | "violet" | "teal" | "yellow" | "sky" | "ink" | "grey" | "rust";
type Size = "sm" | "md" | "lg";

const TONE: Record<ButtonTone, string> = {
  paper: "bg-paper text-ink",
  coral: "bg-coral text-ink",
  violet: "bg-violet text-ink",
  teal: "bg-teal text-ink",
  yellow: "bg-yellow text-ink",
  sky: "bg-sky text-ink",
  ink: "bg-ink text-cream",
  grey: "bg-grey text-ink",
  rust: "bg-rust text-cream",
};

/** Every size clears the 44px touch minimum. */
const SIZE: Record<Size, string> = {
  sm: "min-h-[44px] text-[13px] px-3 rounded-[var(--r-sm)]",
  md: "min-h-[48px] text-[15px] px-4 rounded-[var(--r-btn)]",
  lg: "min-h-[56px] text-[17px] px-5 rounded-[var(--r-btn)]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  size?: Size;
  block?: boolean;
  /** `flat` drops the shadow: for secondary and repeated controls, so one object per screen leads. */
  variant?: "raised" | "flat";
}

export function buttonClass({ tone = "paper", size = "md", block = false, variant = "raised" }: Pick<ButtonProps, "tone" | "size" | "block" | "variant">) {
  const depth = variant === "flat" ? "brut-flat" : size === "sm" ? "brut-sm" : "brut";
  return `${depth} pressable inline-flex items-center justify-center gap-2 text-center font-extrabold leading-tight ${TONE[tone]} ${SIZE[size]} ${block ? "w-full" : ""}`;
}

export function Button({ tone, size, block, variant, className = "", type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={`${buttonClass({ tone, size, block, variant })} ${className}`} {...rest} />;
}
