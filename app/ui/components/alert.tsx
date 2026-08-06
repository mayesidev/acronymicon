import type { ComponentProps } from "react";

import { cn } from "../utils";

export type AlertVariant = "neutral" | "warning" | "destructive";

const variantClasses: Record<AlertVariant, string> = {
  neutral: "border-border bg-muted text-foreground",
  warning:
    "border-warning-border bg-warning-surface text-warning-foreground",
  destructive:
    "border-destructive-border bg-destructive-surface text-destructive-foreground",
};

export function Alert({
  variant = "neutral",
  className,
  ...props
}: ComponentProps<"section"> & { variant?: AlertVariant }) {
  return (
    <section
      className={cn(
        "rounded-md border p-4",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
