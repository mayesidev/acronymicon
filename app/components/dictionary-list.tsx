import type { AcronymSearchResult } from "../db/acronyms.server";

export function DictionaryList({
  entries,
  groupByLetter = false,
}: {
  entries: AcronymSearchResult[];
  groupByLetter?: boolean;
}) {
  if (groupByLetter) {
    const groups = groupEntriesByLetter(entries);

    return (
      <ol className="space-y-8">
        {groups.map((group) => (
          <li key={group.letter}>
            <h2 className="mb-2 border-b border-slate-300 pb-2 text-sm font-semibold text-slate-600">
              {group.letter}
            </h2>
            <ol className="divide-y divide-slate-200 overflow-hidden rounded border border-slate-200 bg-white">
              {group.entries.map((entry) => (
                <DictionaryEntry key={entry.id} entry={entry} />
              ))}
            </ol>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className="divide-y divide-slate-200 overflow-hidden rounded border border-slate-200 bg-white">
      {entries.map((entry) => (
        <DictionaryEntry key={entry.id} entry={entry} />
      ))}
    </ol>
  );
}

function DictionaryEntry({ entry }: { entry: AcronymSearchResult }) {
  return (
    <li className="grid gap-4 p-4 md:grid-cols-[8rem_1fr]">
      <div>
        <a
          href={`/define?acr=${encodeURIComponent(entry.acronym)}`}
          className="text-2xl font-semibold tracking-normal text-slate-950 underline-offset-4 hover:underline"
        >
          {entry.acronym}
        </a>
      </div>

      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">
          <a
            href={`/define?acr=${encodeURIComponent(entry.acronym)}&var=${entry.variant}`}
            className="underline-offset-4 hover:underline"
          >
            <DefinitionText
              definition={entry.definition}
              ranges={entry.definitionRanges}
            />
          </a>
        </h2>
        {entry.notes ? (
          <p className="mt-2 text-sm leading-6 text-slate-700">{entry.notes}</p>
        ) : null}

        <p className="mt-3 text-xs text-slate-500">
          Submitted by{" "}
          {entry.submittedByDisplayName ?? entry.submittedByUsername ?? "unknown"}
          <span aria-hidden="true"> | </span>
          <span>Submitted {formatSubmittedDate(entry.createdAt)}</span>
        </p>
      </div>
    </li>
  );
}

export function DefinitionText({
  definition,
  ranges,
}: {
  definition: string;
  ranges: { start: number; end: number }[];
}) {
  if (ranges.length === 0) {
    return definition;
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const [index, range] of ranges.entries()) {
    if (range.start > cursor) {
      parts.push(definition.slice(cursor, range.start));
    }

    parts.push(
      <u
        key={`${range.start}-${range.end}-${index}`}
        className="decoration-2 underline-offset-4"
      >
        {definition.slice(range.start, range.end)}
      </u>,
    );
    cursor = range.end;
  }

  if (cursor < definition.length) {
    parts.push(definition.slice(cursor));
  }

  return parts;
}

export function formatSubmittedDate(createdAt: string) {
  const normalized = createdAt.includes("T")
    ? createdAt
    : `${createdAt.replace(" ", "T")}Z`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return createdAt;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function groupEntriesByLetter(entries: AcronymSearchResult[]) {
  const groups = new Map<string, AcronymSearchResult[]>();

  for (const entry of entries) {
    const firstCharacter = entry.acronym.charAt(0).toUpperCase();
    const letter = /^[A-Z]$/.test(firstCharacter) ? firstCharacter : "#";
    const group = groups.get(letter) ?? [];
    group.push(entry);
    groups.set(letter, group);
  }

  return [...groups].map(([letter, groupEntries]) => ({
    entries: groupEntries,
    letter,
  }));
}
