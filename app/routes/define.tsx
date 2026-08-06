import type { Route } from "./+types/define";
import { Form, useSubmit } from "react-router";

import {
  DefinitionText,
  formatSubmittedDate,
} from "../features/dictionary/components/dictionary-list";
import { lookupDefinition } from "../features/dictionary/server/api";
import {
  dictionarySortOptions,
  type DictionarySort,
} from "../features/dictionary/model";
import { Card } from "../ui/components/card";
import { Field } from "../ui/components/field";
import { TextLink } from "../ui/components/link";
import { NativeSelect } from "../ui/components/native-select";
import { PageShell } from "../ui/components/page-shell";

export function meta() {
  return [{ title: "Definition | Acronymicon" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  const sort: DictionarySort =
    params.get("sort") === "recent" ? "recent" : "alphabetical";
  const result = await lookupDefinition({
    acronym: params.get("acr") ?? "",
    variant: params.get("var"),
    sort,
  });
  return { ...result, sort };
}

export default function Define({ loaderData }: Route.ComponentProps) {
  const submit = useSubmit();
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

      {loaderData.status === "list" ? (
        <Form method="get" className="mt-4 flex justify-end">
          <input type="hidden" name="acr" value={loaderData.acronym} />
          <Field
            label="Sort definitions"
            className="flex items-center gap-2"
            labelClassName="font-normal text-muted-foreground"
          >
            <NativeSelect
              name="sort"
              value={loaderData.sort}
              onChange={(event) => {
                if (event.currentTarget.form) {
                  void submit(event.currentTarget.form, {
                    method: "get",
                    replace: true,
                  });
                }
              }}
              className="min-h-9 w-auto py-1"
            >
              {dictionarySortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </Form>
      ) : null}

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
