import type { ComponentProps } from "react";

import { cn } from "../utils";

export type PageShellWidth = "narrow" | "default" | "wide";

const widthClasses: Record<PageShellWidth, string> = {
  narrow: "max-w-xl",
  default: "max-w-4xl",
  wide: "max-w-6xl",
};

export function PageShell({
  width = "default",
  className,
  contentClassName,
  children,
  ...props
}: ComponentProps<"main"> & {
  width?: PageShellWidth;
  contentClassName?: string;
}) {
  return (
    <main
      className={cn("min-h-screen bg-background text-foreground", className)}
      {...props}
    >
      <div
        className={cn(
          "mx-auto flex w-full flex-col px-4 py-6 sm:px-6 lg:px-8",
          widthClasses[width],
          contentClassName,
        )}
      >
        {children}
      </div>
    </main>
  );
}
