import type { ComponentProps } from "react";

import { cn } from "../utils";
import { useFieldControl } from "./field";
import { formControlClassName } from "./input";

export function Textarea({
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  className,
  ...props
}: ComponentProps<"textarea">) {
  const fieldProps = useFieldControl({ id, describedBy, invalid });

  return (
    <textarea
      {...fieldProps}
      className={cn(formControlClassName, "min-h-28 resize-y", className)}
      {...props}
    />
  );
}
