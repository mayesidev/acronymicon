import { data, redirect } from "react-router";

import type { Route } from "./+types/submit";
import {
  createAcronymEntry,
  findExactDuplicate,
  findPublishedByAcronym,
} from "../db/acronyms.server";
import { getOptionalUser } from "../auth/session.server";
import { SubmissionForm } from "../features/submission/components/submission-form";
import { validateSubmissionInput } from "../features/submission/server/input";
import { createSubmissionWorkflow } from "../features/submission/server/workflow";

const submissionWorkflow = createSubmissionWorkflow({
  createAcronymEntry,
  findExactDuplicate,
  findPublishedByAcronym,
});

export function meta() {
  return [{ title: "Submit acronym | Acronymicon" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getOptionalUser(request);

  if (!user) {
    const returnTo = new URL(request.url).pathname;
    return redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const searchParameters = new URL(request.url).searchParams;
  const duplicatePreview = await submissionWorkflow.loadDuplicatePreview({
    acronym: searchParameters.get("acronym") ?? "",
    definition: searchParameters.get("definition") ?? "",
  });

  return {
    user,
    ...duplicatePreview,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getOptionalUser(request);

  if (!user) {
    return redirect("/auth/login?returnTo=/submit");
  }

  const formData = await request.formData();
  const validation = validateSubmissionInput(Object.fromEntries(formData));

  if (validation.status === "invalid") {
    return data(
      {
        status: "error" as const,
        errors: validation.errors,
        exactDuplicate: null,
        values: validation.values,
      },
      { status: 400 },
    );
  }

  const values = validation.values;
  const outcome = await submissionWorkflow.submit(values, user);

  if (outcome.status === "exact-duplicate") {
    return data(
      {
        status: "error" as const,
        errors: outcome.errors,
        exactDuplicate: outcome.duplicate,
        values,
      },
      { status: 400 },
    );
  }

  if (outcome.status === "duplicate-warning") {
    return data(
      {
        status: "duplicate-warning" as const,
        existingEntries: outcome.existingEntries,
        values,
      },
      { status: 409 },
    );
  }

  return redirect(`/?q=${encodeURIComponent(outcome.acronym)}`);
}

export default function SubmitAcronym({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b border-slate-200 pb-5">
          <a href="/" className="text-link text-sm">
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

        <SubmissionForm actionData={actionData} />
      </div>
    </main>
  );
}
