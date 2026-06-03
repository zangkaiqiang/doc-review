import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "ghost" | "danger" | "success";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand/90 disabled:opacity-50",
  ghost: "bg-transparent text-muted hover:bg-line/60 border border-line",
  danger: "bg-high-soft text-high border border-high/30 hover:bg-high-soft/70",
  success: "bg-good-soft text-good border border-good/30 hover:bg-good-soft/70",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-control px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
        VARIANT[variant],
        className
      )}
      {...props}
    />
  );
}
