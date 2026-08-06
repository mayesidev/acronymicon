import type { ComponentProps } from "react";

import { cn } from "../utils";
import { useFieldControl } from "./field";
import { formControlClassName } from "./input";

export function NativeSelect({
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  className,
  ...props
}: ComponentProps<"select">) {
  const fieldProps = useFieldControl({ id, describedBy, invalid });

  return (
    <select
      {...fieldProps}
      className={cn(formControlClassName, className)}
      {...props}
    />
  );
}
