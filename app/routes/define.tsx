import type { Route } from "./+types/define";
import { Form, redirect, useSubmit } from "react-router";

import {
  DefinitionText,
  formatSubmittedDate,
} from "../features/dictionary/components/dictionary-list";
import {
  authorizeDictionaryAccess,
  withoutSearchParameters,
} from "../features/authentication/server/access";
import {
  lookupDefinition,
  lookupDefinitionById,
  usesControlledDictionarySearch,
} from "../features/dictionary/server/api";
import {
  buildDefinitionHref,
  dictionarySortOptions,
  parseDictionarySort,
} from "../features/dictionary/model";
import { Card } from "../ui/components/card";
import { Field } from "../ui/components/field";
import { TextLink } from "../ui/components/link";
import { NativeSelect } from "../ui/components/native-select";
import { PageShell } from "../ui/components/page-shell";

export function meta() {
  return [{ title: "Definition | Acronymicon" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const hasLegacyContent =
    url.searchParams.has("acr") || url.searchParams.has("var");
  const controlled = usesControlledDictionarySearch();
  const access = await authorizeDictionaryAccess(
    controlled && hasLegacyContent
      ? withoutSearchParameters(request)
      : request,
  );

  if (access instanceof Response) {
    return access;
  }

  if (controlled && hasLegacyContent) {
    return redirect("/");
  }

  const sort = parseDictionarySort(url.searchParams.get("sort"));

  if (params.entryId) {
    const result = await lookupDefinitionById({
      entryId: params.entryId,
      related: url.searchParams.get("view") === "all",
      sort,
    });
    return { ...result, sort };
  }

  const legacyResult = await lookupDefinition({
    acronym: url.searchParams.get("acr") ?? "",
    variant: url.searchParams.get("var"),
    sort,
  });

  if (legacyResult.status === "entry") {
    return redirect(buildDefinitionHref(legacyResult.entry.id));
  }

  if (legacyResult.status === "list" && legacyResult.entries[0]) {
    return redirect(
      buildDefinitionHref(legacyResult.entries[0].id, {
        related: true,
        sort,
      }),
    );
  }

  if (
    legacyResult.status === "not-found" &&
    legacyResult.acronym.trim()
  ) {
    const related = await lookupDefinition({
      acronym: legacyResult.acronym,
      variant: null,
      sort,
    });

    if (related.status === "list" && related.entries[0]) {
      return redirect(
        buildDefinitionHref(related.entries[0].id, { related: true, sort }),
      );
    }
  }

  return { ...legacyResult, sort };
}

export default function Define({ loaderData }: Route.ComponentProps) {
  const submit = useSubmit();
  if (loaderData.status === "missing-acronym") {
    return (
      <Page>
        <h1 className="text-2xl font-semibold">Choose a definition</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Select an acronym or definition from the dictionary to view it here.
        </p>
      </Page>
    );
  }

  if (loaderData.status === "not-found") {
    return (
      <Page>
        <h1 className="text-2xl font-semibold">Definition not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The requested definition is not available.
        </p>
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
          <input type="hidden" name="view" value="all" />
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
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <BackLink />
      {children}
    </PageShell>
  );
}

function BackLink() {
  return (
    <TextLink href="/" className="mb-4 self-start text-sm">
      Back to dictionary
    </TextLink>
  );
}
