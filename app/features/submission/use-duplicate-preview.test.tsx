// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SubmissionDuplicatePreview } from "./model";
import { exactDuplicateMessage } from "./policy";
import { useDuplicatePreview } from "./use-duplicate-preview";

const fetcher = vi.hoisted(() => ({
  data: undefined as SubmissionDuplicatePreview | undefined,
  load: vi.fn(),
}));

vi.mock("react-router", () => ({
  useFetcher: () => fetcher,
}));

const existingEntry = {
  id: "existing-id",
  definition: "Application Programming Interface",
};

describe("submission duplicate preview state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetcher.data = undefined;
    fetcher.load.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces preview loading and encodes the current input", () => {
    renderHook(() =>
      useDuplicatePreview({
        acronym: " API ",
        definition: "Application Programming Interface",
      }),
    );

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(fetcher.load).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(fetcher.load).toHaveBeenCalledWith(
      "/submit?acronym=API&definition=Application+Programming+Interface",
    );
  });

  it("does not load a preview without an acronym", () => {
    renderHook(() =>
      useDuplicatePreview({ acronym: "  ", definition: "Definition" }),
    );

    act(() => {
      vi.runAllTimers();
    });
    expect(fetcher.load).not.toHaveBeenCalled();
  });

  it("ignores a stale response", () => {
    fetcher.data = preview({ checkedDefinition: "Old definition" });

    const { result } = renderHook(() =>
      useDuplicatePreview({ acronym: "API", definition: "New definition" }),
    );

    expect(result.current).toMatchObject({
      exactDuplicate: null,
      existingEntries: [],
      showDuplicateFeedback: false,
      showDuplicateWarning: false,
    });
  });

  it("uses a matching exact-duplicate response", () => {
    fetcher.data = preview({ exactDuplicate: existingEntry });

    const { result } = renderHook(() =>
      useDuplicatePreview({
        acronym: "API",
        definition: "Application Programming Interface",
      }),
    );

    expect(result.current).toMatchObject({
      exactDuplicate: existingEntry,
      existingEntries: [existingEntry],
      showDuplicateFeedback: true,
      showDuplicateWarning: false,
    });
  });

  it("recovers a matching similar-warning action response", () => {
    const { result } = renderHook(() =>
      useDuplicatePreview({
        acronym: "API",
        definition: "Annual Performance Index",
        actionData: {
          status: "duplicate-warning",
          existingEntries: [existingEntry],
          values: {
            acronym: "API",
            definition: "Annual Performance Index",
          },
        },
      }),
    );

    expect(result.current).toMatchObject({
      existingEntries: [existingEntry],
      showDuplicateFeedback: true,
      showDuplicateWarning: true,
    });
  });

  it("recovers a matching exact-duplicate action response", () => {
    const { result } = renderHook(() =>
      useDuplicatePreview({
        acronym: "API",
        definition: "Application Programming Interface",
        actionData: {
          status: "error",
          errors: { definition: [exactDuplicateMessage] },
          exactDuplicate: existingEntry,
          values: {
            acronym: "API",
            definition: "Application Programming Interface",
          },
        },
      }),
    );

    expect(result.current).toMatchObject({
      exactDuplicate: existingEntry,
      showDuplicateFeedback: true,
      showDuplicateWarning: false,
    });
  });
});

function preview(
  overrides: Partial<SubmissionDuplicatePreview>,
): SubmissionDuplicatePreview {
  return {
    checkedAcronym: "API",
    checkedDefinition: "Application Programming Interface",
    existingEntries: [existingEntry],
    exactDuplicate: null,
    definitionError: null,
    ...overrides,
  };
}
