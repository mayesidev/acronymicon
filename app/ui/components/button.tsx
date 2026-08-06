import type { ComponentProps } from "react";

import { cn } from "../utils";

export type ButtonVariant = "primary" | "secondary" | "text";

const baseClasses =
  "inline-flex min-h-control items-center justify-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/85",
  secondary:
    "border border-border bg-secondary text-secondary-foreground shadow-sm hover:bg-accent hover:text-accent-foreground",
  text: "px-2 text-link underline decoration-link-decoration underline-offset-4 hover:text-link-hover",
};

export function buttonClassName({
  variant,
  className,
}: {
  variant: ButtonVariant;
  className?: string;
}) {
  return cn(baseClasses, variantClasses[variant], className);
}

export function Button({
  type = "button",
  variant = "primary",
  pending = false,
  disabled,
  className,
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  pending?: boolean;
}) {
  return (
    <button
      type={type}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      className={buttonClassName({ variant, className })}
      {...props}
    />
  );
}
