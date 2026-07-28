import type { Route } from "./+types/home";
import { Form } from "react-router";

import { listPublishedAcronyms } from "../db/acronyms.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Acronymicon" },
    { name: "description", content: "Internal acronym dictionary" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const entries = await listPublishedAcronyms(query);

  return {
    entries,
    query,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { entries, query } = loaderData;
  const hasEntries = entries.length > 0;
  const isFiltered = query.trim().length > 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950">
              Acronymicon
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Internal acronym dictionary
            </p>
          </div>

          <Form method="get" className="flex w-full gap-2 md:max-w-xl">
            <label htmlFor="search" className="sr-only">
              Search acronyms
            </label>
            <input
              id="search"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search acronym, definition, notes, category, or tag"
              className="min-h-11 flex-1 rounded border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
            />
            <button
              type="submit"
              className="min-h-11 rounded bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              Search
            </button>
          </Form>
        </header>

        <section className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {isFiltered
              ? `${entries.length} result${entries.length === 1 ? "" : "s"} for "${query}"`
              : `${entries.length} published entr${entries.length === 1 ? "y" : "ies"}`}
          </p>
          {isFiltered ? (
            <a
              href="/"
              className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
            >
              Clear search
            </a>
          ) : null}
        </section>

        {hasEntries ? (
          <AcronymList entries={entries} />
        ) : (
          <EmptyState isFiltered={isFiltered} />
        )}
      </div>
    </main>
  );
}

function AcronymList({
  entries,
}: {
  entries: Awaited<ReturnType<typeof listPublishedAcronyms>>;
}) {
  return (
    <ol className="divide-y divide-slate-200 overflow-hidden rounded border border-slate-200 bg-white">
      {entries.map((entry) => (
        <li key={entry.id} className="grid gap-4 p-4 md:grid-cols-[8rem_1fr]">
          <div>
            <p className="text-2xl font-semibold tracking-normal text-slate-950">
              {entry.acronym}
            </p>
            {entry.category ? (
              <p className="mt-1 text-xs font-medium uppercase tracking-normal text-slate-500">
                {entry.category}
              </p>
            ) : null}
          </div>

          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">
              {entry.definition}
            </h2>
            {entry.notes ? (
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {entry.notes}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Submitted by{" "}
              {entry.submittedByDisplayName ??
                entry.submittedByUsername ??
                "unknown"}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function EmptyState({ isFiltered }: { isFiltered: boolean }) {
  return (
    <section className="rounded border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold tracking-normal text-slate-950">
        {isFiltered ? "No matching acronyms" : "No acronyms yet"}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        {isFiltered
          ? "Try a different acronym, definition, note, category, or tag."
          : "Run the seed import or submit the first acronym once submissions are available."}
      </p>
    </section>
  );
}
