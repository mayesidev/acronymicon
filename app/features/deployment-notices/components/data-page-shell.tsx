import type { ComponentProps } from "react";

import { PageShell } from "../../../ui/components/page-shell";

export function DataPageShell({
  sensitivityLabel,
  children,
  ...props
}: ComponentProps<typeof PageShell> & { sensitivityLabel?: string }) {
  return (
    <PageShell {...props}>
      {sensitivityLabel ? (
        <aside
          aria-label="Content handling notice"
          className="mb-5 rounded-md border border-border bg-muted px-4 py-2 text-center text-sm font-semibold text-foreground"
        >
          {sensitivityLabel}
        </aside>
      ) : null}
      {children}
    </PageShell>
  );
}
