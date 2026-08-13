import type { Route } from "./+types/home";
import {
  Form,
  redirect,
  useFetcher,
  useLocation,
  useSubmit,
} from "react-router";

import { buildAboutHref } from "../features/about/model";
import { HeaderActions } from "../features/authentication/components/header-actions";
import {
  authorizeDictionaryAccess,
  shouldShowSubmissionAction,
  withoutSearchParameters,
} from "../features/authentication/server/access";
import { DictionaryList } from "../features/dictionary/components/dictionary-list";
import {
  dictionarySortOptions,
  parseDictionarySort,
  type DictionarySort,
} from "../features/dictionary/model";
import {
  loadDictionarySearch,
  usesControlledDictionarySearch,
} from "../features/dictionary/server/api";
import { useDictionarySearch } from "../features/dictionary/use-dictionary-search";
import { Button } from "../ui/components/button";
import { Card } from "../ui/components/card";
import { Field } from "../ui/components/field";
import { Input } from "../ui/components/input";
import { TextLink } from "../ui/components/link";
import { NativeSelect } from "../ui/components/native-select";
import { PageShell } from "../ui/components/page-shell";

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
  const controlledSearch = usesControlledDictionarySearch();
  const url = new URL(request.url);
  const user = await authorizeDictionaryAccess(
    controlledSearch ? withoutSearchParameters(request) : request,
  );

  if (user instanceof Response) {
    return user;
  }

  if (controlledSearch && url.search) {
    return redirect("/");
  }

  const query = controlledSearch ? "" : (url.searchParams.get("q") ?? "");
  const sort = controlledSearch
    ? "alphabetical"
    : parseDictionarySort(url.searchParams.get("sort"));
  const searchResult = await loadDictionarySearch(query, sort);

  return {
    ...searchResult,
    controlledSearch,
    user,
    showSubmit: shouldShowSubmissionAction(user),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const controlledSearch = usesControlledDictionarySearch();
  const user = await authorizeDictionaryAccess(
    controlledSearch ? withoutSearchParameters(request) : request,
  );

  if (user instanceof Response) {
    return user;
  }

  if (!controlledSearch) {
    return new Response(null, {
      status: 405,
      statusText: "Method Not Allowed",
    });
  }

  const formData = await request.formData();
  return loadDictionarySearch(
    getFormDataString(formData, "q"),
    parseDictionarySort(getFormDataString(formData, "sort")),
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const location = useLocation();
  const submit = useSubmit();
  const {
    data: controlledSearchResult,
    Form: ControlledSearchForm,
    submit: submitControlledSearch,
  } = useFetcher<typeof action>();
  const {
    clearSearch,
    searchResult,
    searchValue,
    setSearchValue,
    setSortValue,
    sortValue,
  } = useDictionarySearch({
    initialResult: loaderData,
    controlledResult: controlledSearchResult,
    controlledSearch: loaderData.controlledSearch,
    submitControlledSearch,
    submitStandardSearch: submit,
  });
  const SearchForm = loaderData.controlledSearch ? ControlledSearchForm : Form;
  const entryCount = searchResult.entries.length;
  const hasEntries = entryCount > 0;
  const isFiltered = searchResult.query.trim().length > 0;
  const resultSummary = isFiltered
    ? `${entryCount} result${entryCount === 1 ? "" : "s"} for "${searchResult.query}"`
    : `${entryCount} published entr${entryCount === 1 ? "y" : "ies"}`;

  return (
    <PageShell width="wide" contentClassName="gap-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-baseline gap-4">
            <h1 className="text-3xl font-semibold tracking-normal text-foreground">
              Acronymicon
            </h1>
            <TextLink
              aria-label="About Acronymicon"
              href={buildAboutHref(
                `${location.pathname}${location.search}${location.hash}`,
              )}
              className="text-sm"
            >
              About
            </TextLink>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            A book of knowledge for acronyms
          </p>
        </div>

        <HeaderActions user={user} showSubmit={loaderData.showSubmit} />
      </header>

      <section aria-label="Search dictionary">
        <SearchForm
          method={loaderData.controlledSearch ? "post" : "get"}
          action="/"
          className="flex w-full items-start gap-2"
        >
          <Field
            id="search"
            label="Search acronyms"
            labelClassName="sr-only"
            className="flex-1"
          >
            <Input
              name="q"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search acronym or definition"
            />
          </Field>
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
        </SearchForm>
      </section>

      <section className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {resultSummary}
        </p>
        <Field
          label="Sort results"
          className="flex items-center gap-2"
          labelClassName="font-normal text-muted-foreground"
        >
          <NativeSelect
            value={sortValue}
            onChange={(event) =>
              setSortValue(event.target.value as DictionarySort)
            }
            className="min-h-9 w-auto py-1"
          >
            {dictionarySortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </section>

      {hasEntries ? (
        <DictionaryList
          entries={searchResult.entries}
          groupByLetter={!isFiltered && searchResult.sort === "alphabetical"}
        />
      ) : (
        <EmptyState isFiltered={isFiltered} />
      )}
    </PageShell>
  );
}

function getFormDataString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function EmptyState({ isFiltered }: { isFiltered: boolean }) {
  return (
    <Card className="border-dashed border-input p-8 text-center">
      <h2 className="text-lg font-semibold tracking-normal text-foreground">
        {isFiltered ? "No matching acronyms" : "No acronyms yet"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {isFiltered
          ? "Try a different acronym or definition."
          : "Run the seed import or submit the first acronym once submissions are available."}
      </p>
    </Card>
  );
}
