import { Card } from "../../../ui/components/card";
import { TextLink } from "../../../ui/components/link";
import type { DictionaryEntry } from "../model";

export function DictionaryList({
  entries,
  groupByLetter = false,
}: {
  entries: DictionaryEntry[];
  groupByLetter?: boolean;
}) {
  if (groupByLetter) {
    const groups = groupEntriesByLetter(entries);

    return (
      <ol className="space-y-8">
        {groups.map((group) => (
          <li key={group.letter}>
            <h2 className="mb-2 border-b border-border pb-2 text-xl font-semibold text-foreground">
              {group.letter}
            </h2>
            <Card className="overflow-hidden">
              <ol className="divide-y divide-border">
                {group.entries.map((entry) => (
                  <DictionaryEntryItem key={entry.id} entry={entry} />
                ))}
              </ol>
            </Card>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <Card className="overflow-hidden">
      <ol className="divide-y divide-border">
        {entries.map((entry) => (
          <DictionaryEntryItem key={entry.id} entry={entry} />
        ))}
      </ol>
    </Card>
  );
}

function DictionaryEntryItem({ entry }: { entry: DictionaryEntry }) {
  return (
    <li className="grid gap-4 p-4 md:grid-cols-[8rem_1fr]">
      <div>
        <TextLink
          href={`/define?acr=${encodeURIComponent(entry.acronym)}`}
          className="text-2xl font-semibold tracking-normal no-underline"
        >
          {entry.acronym}
        </TextLink>
      </div>

      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-normal text-foreground">
          <TextLink
            href={`/define?acr=${encodeURIComponent(entry.acronym)}&var=${entry.variant}`}
            className="no-underline"
          >
            <DefinitionText
              definition={entry.definition}
              ranges={entry.definitionRanges}
            />
          </TextLink>
        </h2>
        {entry.notes ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {entry.notes}
          </p>
        ) : null}

        <p className="mt-3 text-xs text-muted-foreground">
          Submitted by{" "}
          {entry.submittedByDisplayName ??
            entry.submittedByUsername ??
            "unknown"}
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

function groupEntriesByLetter(entries: DictionaryEntry[]) {
  const groups = new Map<string, DictionaryEntry[]>();

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
