import { Form } from "react-router";

import { Button } from "../../../ui/components/button";
import { ActionLink } from "../../../ui/components/link";

export function SignOutConfirmation() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <section className="mx-auto max-w-xl rounded border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold tracking-normal">Sign out</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          End your Acronymicon session on this browser.
        </p>
        <Form method="post" className="mt-5 flex gap-3">
          <Button type="submit">Sign out</Button>
          <ActionLink href="/" variant="secondary">
            Cancel
          </ActionLink>
        </Form>
      </section>
    </main>
  );
}
