import { Form } from "react-router";

import { Button } from "../../../ui/components/button";
import { ActionLink, TextLink } from "../../../ui/components/link";
import type { AuthUser } from "../model";

export function HeaderActions({ user }: { user: AuthUser | null }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm md:justify-end">
      <ActionLink href="/submit">Submit acronym</ActionLink>

      {user ? (
        <div
          role="group"
          aria-label="Account"
          className="border-l border-border pl-4"
        >
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <div className="mt-0.5 flex items-center gap-3">
            <span className="font-semibold text-foreground">
              {user.displayName ?? user.username}
            </span>
            <Form method="post" action="/auth/logout">
              <Button type="submit" variant="text">
                Sign out
              </Button>
            </Form>
          </div>
        </div>
      ) : (
        <TextLink href="/auth/login">Sign in</TextLink>
      )}
    </div>
  );
}
