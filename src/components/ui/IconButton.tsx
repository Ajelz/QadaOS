import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";

/** 44px square icon control. `flat` for repeated controls in lists, so they do not form a ladder of shadows. */
export function IconButton({ icon, label, flat = false, className = "", type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; flat?: boolean }) {
  return (
    <button type={type} aria-label={label} title={label} className={`${flat ? "brut-flat" : "brut-sm"} pressable grid h-11 w-11 shrink-0 place-items-center rounded-[var(--r-sm)] ${className}`} {...rest}>
      <Icon name={icon} size={20} />
    </button>
  );
}
