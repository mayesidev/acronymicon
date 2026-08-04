import type { Route } from "./+types/home";
import { Form } from "react-router";

import { getOptionalUser } from "../auth/session.server";
import { DictionaryList } from "../components/dictionary-list";
import { listPublishedAcronyms } from "../db/acronyms.server";

export function meta() {
  return [
    { title: "Acronymicon" },
    { name: "description", content: "Internal acronym dictionary" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const [entries, user] = await Promise.all([
    listPublishedAcronyms(query),
    getOptionalUser(request),
  ]);

  return {
    entries,
    query,
    user,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { entries, query, user } = loaderData;
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

          <div className="flex w-full flex-col gap-3 md:max-w-xl">
            <Form method="get" className="flex w-full gap-2">
              <label htmlFor="search" className="sr-only">
                Search acronyms
              </label>
              <input
                id="search"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Search acronym or definition"
                className="min-h-11 flex-1 rounded border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
              />
              <button
                type="submit"
                className="min-h-11 rounded bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              >
                Search
              </button>
            </Form>

            <div className="flex items-center justify-end gap-3 text-sm">
              {user ? (
                <>
                  <span className="text-slate-600">
                    {user.displayName ?? user.username}
                  </span>
                  <a
                    href="/submit"
                    className="font-medium text-slate-800 underline-offset-4 hover:underline"
                  >
                    Submit acronym
                  </a>
                  <Form method="post" action="/auth/logout">
                    <button
                      type="submit"
                      className="font-medium text-slate-600 underline-offset-4 hover:underline"
                    >
                      Sign out
                    </button>
                  </Form>
                </>
              ) : (
                <>
                  <a
                    href="/submit"
                    className="font-medium text-slate-800 underline-offset-4 hover:underline"
                  >
                    Submit acronym
                  </a>
                  <a
                    href="/auth/login"
                    className="font-medium text-slate-600 underline-offset-4 hover:underline"
                  >
                    Sign in
                  </a>
                </>
              )}
            </div>
          </div>
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
          <DictionaryList entries={entries} />
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
