import type { Route } from "./+types/define";

import {
  DefinitionText,
  formatSubmittedDate,
} from "../components/dictionary-list";
import {
  findPublishedByAcronym,
  findPublishedByVariant,
} from "../db/acronyms.server";
import { createDictionaryDefinitionService } from "../features/dictionary/server/definition";

const dictionaryDefinitionService = createDictionaryDefinitionService({
  findPublishedByAcronym,
  findPublishedByVariant,
});

export function meta() {
  return [{ title: "Definition | Acronymicon" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  return dictionaryDefinitionService.lookupDefinition({
    acronym: params.get("acr") ?? "",
    variant: params.get("var"),
  });
}

export default function Define({ loaderData }: Route.ComponentProps) {
  if (loaderData.status === "missing-acronym") {
    return (
      <Page>
        <h1 className="text-2xl font-semibold">Choose an acronym</h1>
        <p className="mt-2 text-sm text-slate-600">
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
        <p className="mt-2 text-sm text-slate-600">
          Variant {loaderData.variant} is not available for {loaderData.acronym}
          .
        </p>
        <a
          href={`/define?acr=${encodeURIComponent(loaderData.acronym)}`}
          className="text-link mt-4 inline-block text-sm"
        >
          View all definitions for {loaderData.acronym}
        </a>
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
      <p className="mt-2 text-sm text-slate-600">
        {loaderData.status === "entry"
          ? "Definition"
          : `${entries.length} definition${entries.length === 1 ? "" : "s"}`}
      </p>

      <ol className="mt-6 divide-y divide-slate-200 overflow-hidden rounded border border-slate-200 bg-white">
        {entries.map((entry) => (
          <li key={entry.id} className="p-4">
            <h2 className="text-lg font-semibold">
              <DefinitionText
                definition={entry.definition}
                ranges={entry.definitionRanges}
              />
            </h2>
            {entry.notes ? (
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {entry.notes}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-slate-500">
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
      <BackLink />
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}

function BackLink() {
  return (
    <a href="/" className="text-link mt-6 inline-block text-sm">
      Back to dictionary
    </a>
  );
}
