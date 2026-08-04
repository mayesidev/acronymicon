import type { AcronymSearchResult } from "../db/acronyms.server";

export function DictionaryList({
  entries,
}: {
  entries: AcronymSearchResult[];
}) {
  return (
    <ol className="divide-y divide-slate-200 overflow-hidden rounded border border-slate-200 bg-white">
      {entries.map((entry) => (
        <li key={entry.id} className="grid gap-4 p-4 md:grid-cols-[8rem_1fr]">
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
                className="underline decoration-slate-300 underline-offset-4 hover:decoration-slate-700"
              >
                <DefinitionText
                  definition={entry.definition}
                  ranges={entry.definitionRanges}
                />
              </a>
            </h2>
            {entry.notes ? (
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {entry.notes}
              </p>
            ) : null}

            <p className="mt-3 text-xs text-slate-500">
              Submitted by{" "}
              {entry.submittedByDisplayName ??
                entry.submittedByUsername ??
                "unknown"}
            </p>
          </div>
        </li>
      ))}
    </ol>
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
      <strong key={`${range.start}-${range.end}-${index}`}>
        {definition.slice(range.start, range.end)}
      </strong>,
    );
    cursor = range.end;
  }

  if (cursor < definition.length) {
    parts.push(definition.slice(cursor));
  }

  return parts;
}
