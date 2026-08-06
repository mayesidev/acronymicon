import {
  createContext,
  useContext,
  useId,
  type ComponentProps,
  type ReactNode,
} from "react";

import { cn } from "../utils";

type FieldContextValue = {
  controlId: string;
  describedBy?: string;
  invalid: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

export function Field({
  id,
  label,
  description,
  error,
  children,
  className,
  labelClassName,
  ...props
}: Omit<ComponentProps<"div">, "id"> & {
  id?: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  labelClassName?: string;
}) {
  const generatedId = useId();
  const controlId = id ?? `field-${generatedId}`;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ");

  return (
    <FieldContext.Provider
      value={{
        controlId,
        describedBy: describedBy || undefined,
        invalid: Boolean(error),
      }}
    >
      <div className={cn("grid gap-1.5", className)} {...props}>
        <label
          htmlFor={controlId}
          className={cn("text-sm font-medium text-foreground", labelClassName)}
        >
          {label}
        </label>
        {children}
        {description ? (
          <p id={descriptionId} className="text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

export function useFieldControl({
  id,
  describedBy,
  invalid,
}: {
  id?: string;
  describedBy?: string;
  invalid?: ComponentProps<"input">["aria-invalid"];
}) {
  const field = useContext(FieldContext);
  const descriptionIds = [describedBy, field?.describedBy]
    .filter(Boolean)
    .join(" ");

  return {
    id: field?.controlId ?? id,
    "aria-describedby": descriptionIds || undefined,
    "aria-invalid": field?.invalid || invalid || undefined,
  };
}
