import { Card } from "../../../ui/components/card";
import { TextLink } from "../../../ui/components/link";
import { PageShell } from "../../../ui/components/page-shell";
import { licenseUrl, sourceRepositoryUrl } from "../model";

export function AboutPage({
  version,
  returnTo,
}: {
  version: string;
  returnTo: string;
}) {
  return (
    <PageShell contentClassName="gap-6">
      <header className="border-b border-border pb-5">
        <TextLink href={returnTo} className="text-sm">
          Back to dictionary
        </TextLink>
        <h1 className="mt-4 text-3xl font-semibold tracking-normal">
          About Acronymicon
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Acronymicon is self-hosted dictionary software for sharing and
          discovering acronym definitions within an organization. The
          application source code is open source; the contents of each hosted
          dictionary are not part of the public source project.
        </p>
      </header>

      <Card className="p-5 sm:p-6">
        <dl className="divide-y divide-border">
          <Detail label="Version">
            <code className="rounded-sm bg-muted px-2 py-1 font-mono text-sm">
              {version}
            </code>
          </Detail>
          <Detail label="License">
            <TextLink href={licenseUrl}>Read the MIT License</TextLink>
          </Detail>
          <Detail label="Source code">
            <TextLink href={sourceRepositoryUrl}>
              View Acronymicon source on GitHub
            </TextLink>
          </Detail>
        </dl>
      </Card>
    </PageShell>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr] sm:items-center">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
