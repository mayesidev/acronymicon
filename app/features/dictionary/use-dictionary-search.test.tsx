// @vitest-environment jsdom

import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import type { FetcherSubmitFunction, SubmitFunction } from "react-router";
import { afterEach, expect, it, vi } from "vitest";

import { parseDictionarySort } from "./model";
import { useDictionarySearch } from "./use-dictionary-search";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

it.each([
  { controlled: false, method: "get", options: { method: "get", replace: true } },
  { controlled: true, method: "post", options: { method: "post", action: "/?index" } },
])("submits $method search input entered before hydration", async ({
  controlled,
  options,
}) => {
  const submitControlled = vi.fn();
  const submitStandard = vi.fn();
  const view = (
    <SearchProbe
      controlled={controlled}
      submitControlled={submitControlled}
      submitStandard={submitStandard}
    />
  );
  const container = document.createElement("div");
  container.innerHTML = renderToString(view);
  document.body.append(container);
  const search = container.querySelector("input")!;
  const sort = container.querySelector("select")!;
  search.value = "private term";
  sort.value = "recent";
  vi.useFakeTimers();

  let root!: ReturnType<typeof hydrateRoot>;
  act(() => {
    root = hydrateRoot(container, view);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(150);
  });

  expect(search.value).toBe("private term");
  expect(sort.value).toBe("recent");
  const expectedValues = { q: "private term", sort: "recent" };
  if (controlled) {
    expect(submitControlled).toHaveBeenCalledWith(expectedValues, options);
    expect(submitStandard).not.toHaveBeenCalled();
  } else {
    expect(submitStandard).toHaveBeenCalledWith(expectedValues, options);
    expect(submitControlled).not.toHaveBeenCalled();
  }

  act(() => {
    root.unmount();
  });
});

function SearchProbe({
  controlled,
  submitControlled,
  submitStandard,
}: {
  controlled: boolean;
  submitControlled: ReturnType<typeof vi.fn>;
  submitStandard: ReturnType<typeof vi.fn>;
}) {
  const {
    searchRef,
    searchValue,
    setSearchValue,
    sortRef,
    sortValue,
    setSortValue,
  } = useDictionarySearch({
    initialResult: { entries: [], query: "", sort: "alphabetical" },
    controlledSearch: controlled,
    submitControlledSearch: submitControlled as unknown as FetcherSubmitFunction,
    submitStandardSearch: submitStandard as unknown as SubmitFunction,
  });

  return (
    <>
      <input
        ref={searchRef}
        value={searchValue}
        onChange={(event) => setSearchValue(event.target.value)}
      />
      <select
        ref={sortRef}
        value={sortValue}
        onChange={(event) => setSortValue(parseDictionarySort(event.target.value))}
      >
        <option value="alphabetical">Alphabetical</option>
        <option value="recent">Recent</option>
      </select>
    </>
  );
}
