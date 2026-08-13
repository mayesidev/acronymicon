import { Form } from "react-router";

import { Button } from "../../../ui/components/button";
import { ActionLink } from "../../../ui/components/link";
import type { AuthUser } from "../model";

export function HeaderActions({
  user,
  showSubmit = true,
}: {
  user: AuthUser | null;
  showSubmit?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm md:justify-end">
      {showSubmit ? (
        <nav aria-label="Dictionary actions" className="flex items-center">
          <ActionLink href="/submit">Submit acronym</ActionLink>
        </nav>
      ) : null}

      {user ? (
        <div
          role="group"
          aria-label="Account"
          className="flex items-center gap-3 border-l border-border pl-3"
        >
          <p className="text-muted-foreground">
            <span className="text-xs">Signed in as</span>{" "}
            <span className="font-semibold text-foreground">
              {user.displayName ?? user.username}
            </span>
          </p>
          <Form method="post" action="/auth/logout">
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </Form>
        </div>
      ) : (
        <ActionLink href="/auth/login" variant="secondary">
          Sign in
        </ActionLink>
      )}
    </div>
  );
}
