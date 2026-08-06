import { useId, useRef } from "react";

import { Button } from "../../../ui/components/button";
import { Alert } from "../../../ui/components/alert";
import type { SubmissionDuplicateEntry } from "../model";

export function DuplicateFeedback({
  acronym,
  exactDuplicate,
  existingEntries,
}: {
  acronym: string;
  exactDuplicate: SubmissionDuplicateEntry | null;
  existingEntries: SubmissionDuplicateEntry[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const openDialog = () => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  };

  const closeDialog = () => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
    triggerRef.current?.focus();
  };

  if (!exactDuplicate && existingEntries.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        ref={triggerRef}
        variant="secondary"
        className="gap-2 border-warning-border text-warning-foreground"
        aria-haspopup="dialog"
        onClick={openDialog}
      >
        <WarningIcon />
        See warning
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-lg border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-slate-950/50"
      >
        <div className="p-5">
          <DuplicateDetails
            acronym={acronym}
            exactDuplicate={exactDuplicate}
            existingEntries={existingEntries}
            titleId={titleId}
          />
          <div className="mt-5 flex justify-end">
            <Button variant="secondary" onClick={closeDialog}>
              Close
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

function DuplicateDetails({
  acronym,
  exactDuplicate,
  existingEntries,
  titleId,
}: {
  acronym: string;
  exactDuplicate: SubmissionDuplicateEntry | null;
  existingEntries: SubmissionDuplicateEntry[];
  titleId: string;
}) {
  if (exactDuplicate) {
    return (
      <Alert variant="destructive">
        <h2 id={titleId} className="font-semibold tracking-normal">
          This definition already exists
        </h2>
        <p className="mt-1 text-sm">
          An identical acronym and definition is already in the dictionary.
        </p>
        <DefinitionList entries={[exactDuplicate]} />
      </Alert>
    );
  }

  if (existingEntries.length === 0) {
    return null;
  }

  return (
    <Alert variant="warning">
      <h2 id={titleId} className="font-semibold tracking-normal">
        {acronym.toUpperCase()} already exists
      </h2>
      <p className="mt-1 text-sm">
        Review the existing definitions before submitting another meaning.
      </p>
      <DefinitionList entries={existingEntries} />
    </Alert>
  );
}

function WarningIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 shrink-0 fill-none stroke-current stroke-2"
    >
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9v5" />
      <path d="M12 17.5v.01" />
    </svg>
  );
}

function DefinitionList({ entries }: { entries: SubmissionDuplicateEntry[] }) {
  return (
    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
      {entries.map((entry) => (
        <li key={entry.id}>{entry.definition}</li>
      ))}
    </ul>
  );
}
