import type { ComponentProps } from "react";

import { cn } from "../utils";
import { useFieldControl } from "./field";

export const formControlClassName =
  "min-h-control w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20";

export function Input({
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  className,
  ...props
}: ComponentProps<"input">) {
  const fieldProps = useFieldControl({ id, describedBy, invalid });

  return (
    <input
      {...fieldProps}
      className={cn(formControlClassName, className)}
      {...props}
    />
  );
}
