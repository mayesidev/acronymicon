import { Form } from "react-router";

import { Button } from "../../../ui/components/button";
import { Card } from "../../../ui/components/card";
import { PageShell } from "../../../ui/components/page-shell";

export function AccessNotice({
  notice,
  token,
  returnTo,
}: {
  notice: string;
  token: string;
  returnTo: string;
}) {
  return (
    <PageShell width="narrow" contentClassName="py-10">
      <Card className="p-6">
        <h1 className="text-xl font-semibold tracking-normal">
          Before you sign in
        </h1>
        <p className="mt-3 whitespace-pre-line text-sm leading-6">{notice}</p>
        <Form
          method="post"
          action={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}
          aria-label="Continue to sign in"
          className="mt-5"
        >
          <input type="hidden" name="noticeToken" value={token} />
          <Button type="submit">Continue to sign in</Button>
        </Form>
      </Card>
    </PageShell>
  );
}
