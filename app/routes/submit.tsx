import { data, redirect } from "react-router";

import type { Route } from "./+types/submit";
import {
  authorizeSubmissionAccess,
  withoutSearchParameters,
} from "../features/authentication/server/access";
import { SubmissionForm } from "../features/submission/components/submission-form";
import {
  getSuccessfulSubmissionLocation,
  loadDuplicatePreview,
  submitAcronym,
} from "../features/submission/server/api";
import { validateSubmissionInput } from "../features/submission/server/input";
import { TextLink } from "../ui/components/link";
import { PageShell } from "../ui/components/page-shell";

export function meta() {
  return [{ title: "Submit acronym | Acronymicon" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await authorizeSubmissionAccess(
    withoutSearchParameters(request),
  );

  if (user instanceof Response) {
    return user;
  }

  return { user };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await authorizeSubmissionAccess(
    withoutSearchParameters(request),
  );

  if (user instanceof Response) {
    return user;
  }

  const formData = await request.formData();

  if (formData.get("intent") === "preview") {
    const duplicatePreview = await loadDuplicatePreview({
      acronym: getFormDataString(formData, "acronym"),
      definition: getFormDataString(formData, "definition"),
    });

    return {
      status: "preview" as const,
      ...duplicatePreview,
    };
  }

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
  const outcome = await submitAcronym(values, user);

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

  return redirect(getSuccessfulSubmissionLocation(outcome.acronym));
}

export default function SubmitAcronym({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  const submissionActionData =
    actionData?.status === "preview" ? undefined : actionData;

  return (
    <PageShell contentClassName="gap-6">
      <header className="border-b border-border pb-5">
        <TextLink href="/" className="text-sm">
          Back to dictionary
        </TextLink>
        <h1 className="mt-4 text-3xl font-semibold tracking-normal">
          Submit acronym
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {loaderData.user.displayName ?? loaderData.user.username}
        </p>
      </header>

      <SubmissionForm actionData={submissionActionData} />
    </PageShell>
  );
}

function getFormDataString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
