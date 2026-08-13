// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRoutesStub, redirect } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  authorizeDictionaryAccess: vi.fn(),
  loadDictionarySearch: vi.fn(),
  shouldShowSubmissionAction: vi.fn(),
  usesControlledDictionarySearch: vi.fn(),
}));

vi.mock("../features/authentication/server/access", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../features/authentication/server/access")
  >();

  return {
    ...actual,
    authorizeDictionaryAccess: dependencies.authorizeDictionaryAccess,
    shouldShowSubmissionAction: dependencies.shouldShowSubmissionAction,
  };
});

vi.mock("../features/dictionary/server/api", () => ({
  loadDictionarySearch: dependencies.loadDictionarySearch,
  usesControlledDictionarySearch:
    dependencies.usesControlledDictionarySearch,
}));

import { action, default as Home, loader } from "./home";

const user = {
  id: "user-id",
  username: "reader",
  displayName: "Dictionary Reader",
  groups: ["dictionary-readers"],
};

const entry = {
  id: "entry-id",
  acronym: "API",
  variant: 1,
  definition: "Application Programming Interface",
  definitionRanges: [],
  notes: null,
  aliases: [],
  submittedByUsername: null,
  submittedByDisplayName: null,
  createdAt: "2026-08-13T00:00:00.000Z",
};

beforeEach(() => {
  dependencies.authorizeDictionaryAccess.mockReset().mockResolvedValue(user);
  dependencies.loadDictionarySearch
    .mockReset()
    .mockImplementation(
      (query: string, sort: "alphabetical" | "recent") =>
        Promise.resolve({ entries: [entry], query, sort }),
    );
  dependencies.shouldShowSubmissionAction.mockReset().mockReturnValue(false);
  dependencies.usesControlledDictionarySearch.mockReset().mockReturnValue(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("home route search boundary", () => {
  it("preserves shareable GET search state in the standard profile", async () => {
    const request = new Request(
      "https://app.example.test/?q=interface&sort=recent",
    );

    await expect(loader({ request } as never)).resolves.toMatchObject({
      entries: [entry],
      query: "interface",
      sort: "recent",
      controlledSearch: false,
    });
    expect(dependencies.authorizeDictionaryAccess).toHaveBeenCalledWith(
      request,
    );
    expect(dependencies.loadDictionarySearch).toHaveBeenCalledWith(
      "interface",
      "recent",
    );
  });

  it("canonicalizes legacy controlled search URLs without reading content", async () => {
    dependencies.usesControlledDictionarySearch.mockReturnValue(true);
    const request = new Request(
      "https://app.example.test/?q=Sensitive&sort=recent",
    );

    const response = await loader({ request } as never);
    const authorizationRequest = dependencies.authorizeDictionaryAccess.mock
      .calls[0]?.[0] as Request;

    expect(authorizationRequest.url).toBe("https://app.example.test/");
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toBe("/");
    expect(dependencies.loadDictionarySearch).not.toHaveBeenCalled();
  });

  it("returns controlled search results from an authenticated POST body", async () => {
    dependencies.usesControlledDictionarySearch.mockReturnValue(true);
    const request = searchRequest({
      query: "Sensitive internal term",
      sort: "recent",
    });

    await expect(action({ request } as never)).resolves.toEqual({
      entries: [entry],
      query: "Sensitive internal term",
      sort: "recent",
    });
    expect(request.url).toBe("https://app.example.test/");
    expect(request.method).toBe("POST");
    expect(dependencies.loadDictionarySearch).toHaveBeenCalledWith(
      "Sensitive internal term",
      "recent",
    );
  });

  it("authorizes a controlled search before reading or reflecting its body", async () => {
    dependencies.usesControlledDictionarySearch.mockReturnValue(true);
    dependencies.authorizeDictionaryAccess.mockResolvedValue(
      redirect("/auth/login?returnTo=%2F"),
    );
    const request = searchRequest({
      query: "Sensitive internal term",
      sort: "alphabetical",
      url: "https://app.example.test/?q=LegacySensitiveTerm",
    });

    const response = await action({ request } as never);
    const authorizationRequest = dependencies.authorizeDictionaryAccess.mock
      .calls[0]?.[0] as Request;

    expect(authorizationRequest.url).toBe("https://app.example.test/");
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Location")).toBe(
      "/auth/login?returnTo=%2F",
    );
    expect(dependencies.loadDictionarySearch).not.toHaveBeenCalled();
  });

  it("does not add a second POST search protocol to the standard profile", async () => {
    const response = await action({
      request: searchRequest({ query: "API", sort: "alphabetical" }),
    } as never);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(405);
    expect(dependencies.loadDictionarySearch).not.toHaveBeenCalled();
  });
});

it("keeps the standard UI search shareable", async () => {
  const Routes = createRoutesStub([
    {
      path: "/",
      Component: Home,
      loader: () => ({
        entries: [entry],
        query: "API",
        sort: "recent" as const,
        controlledSearch: false,
        user,
        showSubmit: false,
      }),
    },
  ]);

  render(<Routes initialEntries={["/?q=API&sort=recent"]} />);
  const searchbox = await screen.findByRole("searchbox", {
    name: "Search acronyms",
  });

  expect(searchbox).toHaveValue("API");
  expect(searchbox.closest("form")).toHaveAttribute("method", "get");
  expect(
    screen.getByRole("link", { name: "About Acronymicon" }),
  ).toHaveAttribute(
    "href",
    "/about?returnTo=%2F%3Fq%3DAPI%26sort%3Drecent",
  );
});

it("submits controlled UI searches without navigation or URL content", async () => {
  let capturedRequest:
    | { method: string; url: string; values: Record<string, FormDataEntryValue> }
    | undefined;
  const Routes = createRoutesStub([
    {
      path: "/",
      Component: Home,
      loader: () => ({
        entries: [],
        query: "",
        sort: "alphabetical" as const,
        controlledSearch: true,
        user,
        showSubmit: false,
      }),
      action: async ({ request }) => {
        const formData = await request.formData();
        const query = formData.get("q");

        if (typeof query !== "string") {
          throw new TypeError("Expected a string search query.");
        }

        capturedRequest = {
          method: request.method,
          url: request.url,
          values: Object.fromEntries(formData),
        };
        return {
          entries: [entry],
          query,
          sort: "alphabetical" as const,
        };
      },
    },
  ]);

  render(<Routes />);
  await screen.findByRole("searchbox", { name: "Search acronyms" });
  vi.useFakeTimers();

  fireEvent.change(screen.getByRole("searchbox", { name: "Search acronyms" }), {
    target: { value: "Sensitive internal term" },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(149);
  });
  expect(capturedRequest).toBeUndefined();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });

  expect(capturedRequest).toEqual({
    method: "POST",
    url: "http://localhost/",
    values: {
      q: "Sensitive internal term",
      sort: "alphabetical",
    },
  });
  expect(
    screen.getByRole("searchbox", { name: "Search acronyms" }).closest("form"),
  ).toHaveAttribute("method", "post");
  expect(
    screen.getByRole("link", { name: "About Acronymicon" }),
  ).toHaveAttribute("href", "/about?returnTo=%2F");
});

function searchRequest({
  query,
  sort,
  url = "https://app.example.test/",
}: {
  query: string;
  sort: "alphabetical" | "recent";
  url?: string;
}) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ q: query, sort }),
  });
}
