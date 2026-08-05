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
  if (exactDuplicate) {
    return (
      <section
        className="rounded border border-red-300 bg-red-50 p-4 text-red-950"
        role="alert"
      >
        <h2 className="font-semibold tracking-normal">
          This definition already exists
        </h2>
        <p className="mt-1 text-sm">
          An identical acronym and definition is already in the dictionary.
        </p>
        <DefinitionList entries={[exactDuplicate]} />
      </section>
    );
  }

  if (existingEntries.length === 0) {
    return null;
  }

  return (
    <section
      className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-950"
      role="status"
    >
      <h2 className="font-semibold tracking-normal">
        {acronym.toUpperCase()} already exists
      </h2>
      <p className="mt-1 text-sm">
        Review the existing definitions before submitting another meaning.
      </p>
      <DefinitionList entries={existingEntries} />
    </section>
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
