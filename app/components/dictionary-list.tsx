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
            <p className="text-2xl font-semibold tracking-normal text-slate-950">
              {entry.acronym}
            </p>
          </div>

          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">
              {entry.definition}
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
