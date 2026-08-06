import type { Route } from "./+types/define";

import {
  DefinitionText,
  formatSubmittedDate,
} from "../features/dictionary/components/dictionary-list";
import { lookupDefinition } from "../features/dictionary/server/api";
import { Card } from "../ui/components/card";
import { TextLink } from "../ui/components/link";
import { PageShell } from "../ui/components/page-shell";

export function meta() {
  return [{ title: "Definition | Acronymicon" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  return lookupDefinition({
    acronym: params.get("acr") ?? "",
    variant: params.get("var"),
  });
}

export default function Define({ loaderData }: Route.ComponentProps) {
  if (loaderData.status === "missing-acronym") {
    return (
      <Page>
        <h1 className="text-2xl font-semibold">Choose an acronym</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add an acronym to the <code>acr</code> query parameter to view its
          definitions.
        </p>
        <BackLink />
      </Page>
    );
  }

  if (loaderData.status === "not-found") {
    return (
      <Page>
        <h1 className="text-2xl font-semibold">Definition not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Variant {loaderData.variant} is not available for {loaderData.acronym}
          .
        </p>
        <TextLink
          href={`/define?acr=${encodeURIComponent(loaderData.acronym)}`}
          className="mt-4 inline-block text-sm"
        >
          View all definitions for {loaderData.acronym}
        </TextLink>
      </Page>
    );
  }

  const entries =
    loaderData.status === "entry" ? [loaderData.entry] : loaderData.entries;

  return (
    <Page>
      <h1 className="text-3xl font-semibold">
        {loaderData.acronym.toUpperCase()}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {loaderData.status === "entry"
          ? "Definition"
          : `${entries.length} definition${entries.length === 1 ? "" : "s"}`}
      </p>

      <Card className="mt-6 overflow-hidden">
        <ol className="divide-y divide-border">
          {entries.map((entry) => (
            <li key={entry.id} className="p-4">
              <h2 className="text-lg font-semibold">
                <DefinitionText
                  definition={entry.definition}
                  ranges={entry.definitionRanges}
                />
              </h2>
              {entry.notes ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {entry.notes}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-muted-foreground">
                Submitted by{" "}
                {entry.submittedByDisplayName ??
                  entry.submittedByUsername ??
                  "unknown"}
                <span aria-hidden="true"> | </span>
                <span>Submitted {formatSubmittedDate(entry.createdAt)}</span>
              </p>
            </li>
          ))}
        </ol>
      </Card>
      <BackLink />
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return <PageShell>{children}</PageShell>;
}

function BackLink() {
  return (
    <TextLink href="/" className="mt-6 inline-block text-sm">
      Back to dictionary
    </TextLink>
  );
}
