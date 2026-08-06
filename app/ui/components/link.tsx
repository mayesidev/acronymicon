import type { ComponentProps, MouseEvent } from "react";

import { buttonClassName } from "./button";
import { cn } from "../utils";

type LinkProps = Omit<ComponentProps<"a">, "aria-disabled"> & {
  disabled?: boolean;
  pending?: boolean;
};

export function ActionLink({
  variant = "primary",
  ...props
}: LinkProps & { variant?: "primary" | "secondary" }) {
  return (
    <SharedLink
      {...props}
      className={buttonClassName({
        variant,
        className: props.className,
      })}
    />
  );
}

export function TextLink({ className, ...props }: LinkProps) {
  return (
    <SharedLink
      {...props}
      className={cn(
        "rounded-sm font-medium text-link underline decoration-link-decoration underline-offset-4 transition-colors hover:text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    />
  );
}

function SharedLink({
  disabled = false,
  pending = false,
  className,
  children,
  href,
  onClick,
  tabIndex,
  ...props
}: LinkProps) {
  const inactive = disabled || pending;

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (inactive) {
      event.preventDefault();
      return;
    }

    onClick?.(event);
  }

  return (
    <a
      aria-busy={pending || undefined}
      aria-disabled={inactive || undefined}
      className={cn(
        "aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
        className,
      )}
      href={href}
      onClick={handleClick}
      tabIndex={inactive ? -1 : tabIndex}
      {...props}
    >
      {children}
    </a>
  );
}
