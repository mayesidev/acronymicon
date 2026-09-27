import { useEffect, useRef, useState } from "react";
import type { FetcherSubmitFunction, SubmitFunction } from "react-router";

import {
  parseDictionarySort,
  type DictionarySearchResult,
  type DictionarySort,
} from "./model";

export function useDictionarySearch({
  initialResult,
  controlledResult,
  controlledSearch,
  submitControlledSearch,
  submitStandardSearch,
}: {
  initialResult: DictionarySearchResult;
  controlledResult?: DictionarySearchResult;
  controlledSearch: boolean;
  submitControlledSearch: FetcherSubmitFunction;
  submitStandardSearch: SubmitFunction;
}) {
  const searchResult =
    controlledSearch && controlledResult ? controlledResult : initialResult;
  const [searchValue, setSearchValue] = useState(initialResult.query);
  const [sortValue, setSortValue] = useState(initialResult.sort);
  const searchRef = useRef<HTMLInputElement>(null);
  const sortRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (searchRef.current) {
      setSearchValue(searchRef.current.value);
    }
    if (sortRef.current) {
      setSortValue(parseDictionarySort(sortRef.current.value));
    }
  }, []);

  useEffect(() => {
    if (
      searchValue === searchResult.query &&
      sortValue === searchResult.sort
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const values = { q: searchValue, sort: sortValue };

      if (controlledSearch) {
        void submitControlledSearch(values, { method: "post", action: "/?index" });
      } else {
        void submitStandardSearch(values, { method: "get", replace: true });
      }
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [
    controlledSearch,
    searchResult.query,
    searchResult.sort,
    searchValue,
    sortValue,
    submitControlledSearch,
    submitStandardSearch,
  ]);

  return {
    clearSearch: () => setSearchValue(""),
    searchResult,
    searchRef,
    searchValue,
    setSearchValue,
    setSortValue: (sort: DictionarySort) => setSortValue(sort),
    sortValue,
    sortRef,
  };
}
