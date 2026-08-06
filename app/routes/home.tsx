import { useEffect, useState } from "react";
import type { Route } from "./+types/home";
import { Form, useSubmit } from "react-router";

import { DictionaryList } from "../components/dictionary-list";
import { HeaderActions } from "../features/authentication/components/header-actions";
import { getOptionalUser } from "../features/authentication/server/session";
import type { DictionarySort } from "../features/dictionary/model";
import { listPublishedAcronyms } from "../features/dictionary/server/api";
import { Button } from "../ui/components/button";

export function meta() {
  return [
    { title: "Acronymicon" },
    {
      name: "description",
      content: "A quick reference for acronyms and definitions",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const sort: DictionarySort =
    url.searchParams.get("sort") === "recent" ? "recent" : "alphabetical";
  const [entries, user] = await Promise.all([
    listPublishedAcronyms(query, sort),
    getOptionalUser(request),
  ]);

  return {
    entries,
    query,
    sort,
    user,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { entries, query, user } = loaderData;
  const submit = useSubmit();
  const [searchValue, setSearchValue] = useState(query);
  const [sortValue, setSortValue] = useState(loaderData.sort);
  const hasEntries = entries.length > 0;
  const isFiltered = query.trim().length > 0;

  function clearSearch() {
    setSearchValue("");
  }

  useEffect(() => {
    if (searchValue === query && sortValue === loaderData.sort) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void submit(
        { q: searchValue, sort: sortValue },
        { method: "get", replace: true },
      );
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [loaderData.sort, query, searchValue, sortValue, submit]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950">
              Acronymicon
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              A book of knowledge for acronyms
            </p>
          </div>

          <HeaderActions user={user} />
        </header>

        <section aria-label="Search dictionary">
          <Form method="get" className="flex w-full gap-2">
            <label htmlFor="search" className="sr-only">
              Search acronyms
            </label>
            <input
              id="search"
              name="q"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search acronym or definition"
              className="min-h-11 flex-1 rounded border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
            />
            <input type="hidden" name="sort" value={sortValue} />
            {isFiltered ? (
              <Button
                type="button"
                variant="secondary"
                onClick={clearSearch}
                className="px-3"
              >
                Clear
              </Button>
            ) : null}
            <Button type="submit">Search</Button>
          </Form>
        </section>

        <section className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            {isFiltered
              ? `${entries.length} result${entries.length === 1 ? "" : "s"} for "${query}"`
              : `${entries.length} published entr${entries.length === 1 ? "y" : "ies"}`}
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span>Sort results</span>
            <select
              value={sortValue}
              onChange={(event) =>
                setSortValue(event.target.value as DictionarySort)
              }
              className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-950"
            >
              <option value="alphabetical">Alphabetical</option>
              <option value="recent">Most recent</option>
            </select>
          </label>
        </section>

        {hasEntries ? (
          <DictionaryList
            entries={entries}
            groupByLetter={!isFiltered && loaderData.sort === "alphabetical"}
          />
        ) : (
          <EmptyState isFiltered={isFiltered} />
        )}
      </div>
    </main>
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
          ? "Try a different acronym or definition."
          : "Run the seed import or submit the first acronym once submissions are available."}
      </p>
    </section>
  );
}
