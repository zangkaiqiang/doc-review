import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANT: Record<Variant, string> = {
  primary: "border border-brand bg-brand text-white shadow-sm hover:bg-brand/90",
  ghost: "border border-line bg-surface text-muted hover:border-line-strong hover:bg-panel hover:text-ink2",
  danger: "border border-high/25 bg-high-soft text-high hover:bg-high-soft/70",
  success: "border border-good/25 bg-good-soft text-good hover:bg-good-soft/70",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-3.5 text-sm",
  lg: "h-10 px-4 text-sm",
  icon: "h-9 w-9 p-0",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-control font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT[variant],
        SIZE[size],
        className
      )}
      {...props}
    />
  );
}
