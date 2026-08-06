import { Form } from "react-router";

import { Button } from "../../../ui/components/button";
import { Card } from "../../../ui/components/card";
import { ActionLink } from "../../../ui/components/link";
import { PageShell } from "../../../ui/components/page-shell";

export function SignOutConfirmation() {
  return (
    <PageShell width="narrow" contentClassName="py-10">
      <Card className="p-6">
        <h1 className="text-xl font-semibold tracking-normal">Sign out</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          End your Acronymicon session on this browser.
        </p>
        <Form method="post" className="mt-5 flex gap-3">
          <Button type="submit">Sign out</Button>
          <ActionLink href="/" variant="secondary">
            Cancel
          </ActionLink>
        </Form>
      </Card>
    </PageShell>
  );
}
