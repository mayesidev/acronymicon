import { Card } from "../../../ui/components/card";
import { TextLink } from "../../../ui/components/link";
import { PageShell } from "../../../ui/components/page-shell";

export function SignInUnavailable() {
  return (
    <PageShell width="narrow" contentClassName="py-10">
      <Card className="p-6">
        <h1 className="text-xl font-semibold tracking-normal">
          Sign-in is not configured
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Browsing is available, but acronym submission requires OIDC
          configuration. Set the OIDC environment variables before using
          sign-in.
        </p>
        <TextLink href="/" className="mt-5 inline-block text-sm">
          Return to dictionary
        </TextLink>
      </Card>
    </PageShell>
  );
}
