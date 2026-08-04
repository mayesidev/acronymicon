import { data, Form, redirect } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/submit";
import {
  createAcronymEntry,
  findExactDuplicate,
  findPublishedByAcronym,
} from "../db/acronyms.server";
import { getOptionalUser } from "../auth/session.server";

const submissionSchema = z.object({
  acronym: z.string().trim().min(1, "Acronym is required."),
  definition: z.string().trim().min(1, "Definition is required."),
  notes: z.string().trim().optional(),
  confirmDuplicate: z.literal("true").optional(),
});

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

  return { user };
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
        values: getSubmissionValues(formData),
      },
      { status: 400 },
    );
  }

  const values = parsed.data;
  const exactDuplicate = await findExactDuplicate(values);

  if (exactDuplicate) {
    return data(
      {
        status: "error" as const,
        errors: {
          definition: ["This acronym and definition already exist."],
        },
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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b border-slate-200 pb-5">
          <a
            href="/"
            className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
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

        {actionData?.status === "duplicate-warning" ? (
          <DuplicateWarning
            acronym={actionData.values.acronym}
            existingEntries={actionData.existingEntries}
          />
        ) : null}

        <Form
          method="post"
          className="rounded border border-slate-200 bg-white p-5"
        >
          {actionData?.status === "duplicate-warning" ? (
            <input type="hidden" name="confirmDuplicate" value="true" />
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Acronym" error={getFieldError(actionData, "acronym")}>
              <input
                name="acronym"
                defaultValue={values?.acronym}
                className="form-input"
                autoComplete="off"
              />
            </Field>

            <Field
              label="Definition"
              error={getFieldError(actionData, "definition")}
            >
              <input
                name="definition"
                defaultValue={values?.definition}
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
              className="rounded bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {actionData?.status === "duplicate-warning"
                ? "Submit Anyway"
                : "Submit"}
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

function DuplicateWarning({
  acronym,
  existingEntries,
}: {
  acronym: string;
  existingEntries: Awaited<ReturnType<typeof findPublishedByAcronym>>;
}) {
  return (
    <section className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <h2 className="font-semibold tracking-normal">
        {acronym.toUpperCase()} already exists
      </h2>
      <p className="mt-1 text-sm">
        Review the existing definitions before submitting another meaning.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        {existingEntries.map((entry) => (
          <li key={entry.id}>{entry.definition}</li>
        ))}
      </ul>
    </section>
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
