import { useEffect, useState } from "react";
import { data, Form, redirect, useFetcher } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/submit";
import {
  createAcronymEntry,
  findExactDuplicate,
  findPublishedByAcronym,
} from "../db/acronyms.server";
import { getOptionalUser } from "../auth/session.server";
import { DuplicateFeedback } from "../components/duplicate-feedback";
import {
  DefinitionMarkupError,
  parseDefinitionMarkup,
  validateDefinitionRanges,
} from "../db/normalize";

const submissionSchema = z.object({
  acronym: z.string().trim().min(1, "Acronym is required."),
  definition: z.string().trim().min(1, "Definition is required."),
  notes: z.string().trim().optional(),
  confirmDuplicate: z.literal("true").optional(),
});

const exactDuplicateMessage = "This acronym and definition already exist.";

type SubmissionFieldName = "acronym" | "definition" | "notes";

export function meta() {
  return [{ title: "Submit acronym | Acronymicon" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getOptionalUser(request);

  if (!user) {
    const returnTo = new URL(request.url).pathname;
    return redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const url = new URL(request.url);
  const acronym = url.searchParams.get("acronym")?.trim() ?? "";
  const definition = url.searchParams.get("definition") ?? "";

  if (!acronym) {
    return {
      user,
      checkedAcronym: "",
      checkedDefinition: "",
      existingEntries: [],
      exactDuplicate: null,
      definitionError: null,
    };
  }

  const definitionError = getDefinitionError(acronym, definition);
  if (definitionError) {
    return {
      user,
      checkedAcronym: acronym,
      checkedDefinition: definition,
      existingEntries: await findPublishedByAcronym(acronym),
      exactDuplicate: null,
      definitionError,
    };
  }

  const [existingEntries, exactDuplicate] = await Promise.all([
    findPublishedByAcronym(acronym),
    definition
      ? findExactDuplicate({ acronym, definition })
      : Promise.resolve(null),
  ]);

  return {
    user,
    checkedAcronym: acronym,
    checkedDefinition: definition,
    existingEntries,
    exactDuplicate,
    definitionError: null,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getOptionalUser(request);

  if (!user) {
    return redirect("/auth/login?returnTo=/submit");
  }

  const formData = await request.formData();
  const parsed = submissionSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return data(
      {
        status: "error" as const,
        errors: parsed.error.flatten().fieldErrors,
        exactDuplicate: null,
        values: getSubmissionValues(formData),
      },
      { status: 400 },
    );
  }

  const values = parsed.data;
  const definitionError = getDefinitionError(values.acronym, values.definition);

  if (definitionError) {
    return data(
      {
        status: "error" as const,
        errors: { definition: [definitionError] },
        exactDuplicate: null,
        values,
      },
      { status: 400 },
    );
  }

  const exactDuplicate = await findExactDuplicate(values);

  if (exactDuplicate) {
    return data(
      {
        status: "error" as const,
        errors: {
          definition: [exactDuplicateMessage],
        },
        exactDuplicate,
        values,
      },
      { status: 400 },
    );
  }

  const existingEntries = await findPublishedByAcronym(values.acronym);

  if (existingEntries.length > 0 && values.confirmDuplicate !== "true") {
    return data(
      {
        status: "duplicate-warning" as const,
        existingEntries,
        values,
      },
      { status: 409 },
    );
  }

  const entry = await createAcronymEntry({
    acronym: values.acronym,
    definition: values.definition,
    notes: values.notes,
    submittedByUserId: user.id,
    submittedByUsername: user.username,
    submittedByDisplayName: user.displayName,
  });

  return redirect(`/?q=${encodeURIComponent(entry.acronym)}`);
}

export default function SubmitAcronym({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  const values = actionData?.values;
  const fetcher = useFetcher<typeof loader>();
  const [acronym, setAcronym] = useState(values?.acronym ?? "");
  const [definition, setDefinition] = useState(values?.definition ?? "");

  useEffect(() => {
    const normalizedAcronym = acronym.trim();
    if (!normalizedAcronym) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({
        acronym: normalizedAcronym,
        definition,
      });
      void fetcher.load(`/submit?${params.toString()}`);
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [acronym, definition, fetcher]);

  const localDefinitionError = getDefinitionError(acronym, definition);
  const currentCheck =
    fetcher.data &&
    fetcher.data.checkedAcronym === acronym.trim() &&
    fetcher.data.checkedDefinition === definition
      ? fetcher.data
      : null;
  const actionWarningMatchesCurrentInput =
    actionData?.status === "duplicate-warning" &&
    actionData.values.acronym === acronym &&
    actionData.values.definition === definition;
  const actionExactDuplicate =
    actionData?.status === "error" &&
    actionData.values.acronym === acronym &&
    actionData.values.definition === definition &&
    getFieldError(actionData, "definition") === exactDuplicateMessage
      ? actionData.exactDuplicate
      : null;
  const exactDuplicate =
    actionExactDuplicate ?? currentCheck?.exactDuplicate ?? null;
  const existingEntries = actionWarningMatchesCurrentInput
    ? actionData.existingEntries
    : currentCheck
      ? currentCheck.existingEntries
      : [];
  const definitionError =
    localDefinitionError ?? currentCheck?.definitionError ?? null;
  const showDuplicateWarning = !exactDuplicate && existingEntries.length > 0;
  const showDuplicateFeedback = Boolean(exactDuplicate) || showDuplicateWarning;
  const definitionFieldError = getFieldError(actionData, "definition");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b border-slate-200 pb-5">
          <a
            href="/"
            className="text-link text-sm"
          >
            Back to dictionary
          </a>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal">
            Submit acronym
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Signed in as{" "}
            {loaderData.user.displayName ?? loaderData.user.username}
          </p>
        </header>

        {showDuplicateFeedback ? (
          <DuplicateFeedback
            acronym={acronym}
            exactDuplicate={exactDuplicate}
            existingEntries={existingEntries}
          />
        ) : null}

        <Form
          method="post"
          className="rounded border border-slate-200 bg-white p-5"
        >
          {showDuplicateWarning ? (
            <input type="hidden" name="confirmDuplicate" value="true" />
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Acronym" error={getFieldError(actionData, "acronym")}>
              <input
                name="acronym"
                value={acronym}
                onChange={(event) => setAcronym(event.target.value)}
                className="form-input"
                autoComplete="off"
              />
            </Field>

            <Field
              label="Definition"
              error={
                (definitionFieldError ===
                exactDuplicateMessage
                  ? undefined
                  : definitionFieldError) ??
                definitionError ??
                undefined
              }
            >
              <input
                name="definition"
                value={definition}
                onChange={(event) => setDefinition(event.target.value)}
                className="form-input"
                autoComplete="off"
              />
            </Field>
          </div>

          <Field label="Notes" error={getFieldError(actionData, "notes")}>
            <textarea
              name="notes"
              defaultValue={values?.notes}
              className="form-input min-h-28 resize-y"
            />
          </Field>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="submit"
              disabled={Boolean(
                exactDuplicate ||
                definitionError ||
                !acronym.trim() ||
                !definition.trim(),
              )}
              className="rounded bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {showDuplicateWarning ? "Submit Anyway" : "Submit"}
            </button>
            <a
              href="/"
              className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Cancel
            </a>
          </div>
        </Form>
      </div>
    </main>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-4 block text-sm font-medium text-slate-700">
      <span>{label}</span>
      <div className="mt-1">{children}</div>
      {error ? <p className="mt-1 text-sm text-red-700">{error}</p> : null}
    </label>
  );
}

function getFieldError(
  actionData: Route.ComponentProps["actionData"],
  field: SubmissionFieldName,
) {
  if (actionData?.status !== "error") {
    return undefined;
  }

  const errors = actionData.errors as Partial<
    Record<SubmissionFieldName, string[]>
  >;

  return errors[field]?.[0];
}

function getSubmissionValues(formData: FormData) {
  return {
    acronym: getFormString(formData, "acronym"),
    definition: getFormString(formData, "definition"),
    notes: getFormString(formData, "notes"),
  };
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getDefinitionError(acronym: string, definition: string) {
  if (!definition.trim()) {
    return null;
  }

  try {
    return validateDefinitionRanges(acronym, parseDefinitionMarkup(definition));
  } catch (error) {
    return error instanceof DefinitionMarkupError
      ? error.message
      : "Definition formatting is invalid.";
  }
}
