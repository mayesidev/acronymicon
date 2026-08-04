export type DefinitionRange = {
  start: number;
  end: number;
};

export type ParsedDefinition = {
  text: string;
  ranges: DefinitionRange[];
};

export class DefinitionMarkupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DefinitionMarkupError";
  }
}

export function normalizeAcronym(value: string) {
  return value.trim().toUpperCase();
}

export function parseDefinitionMarkup(value: string): ParsedDefinition {
  let text = "";
  let rangeStart: number | null = null;
  const ranges: DefinitionRange[] = [];

  for (const character of value) {
    if (character === "[") {
      if (rangeStart !== null) {
        throw new DefinitionMarkupError("Definition ranges cannot be nested.");
      }

      rangeStart = text.length;
      continue;
    }

    if (character === "]") {
      if (rangeStart === null) {
        throw new DefinitionMarkupError(
          "Definition ranges must be opened before they are closed.",
        );
      }

      if (rangeStart === text.length) {
        throw new DefinitionMarkupError("Definition ranges cannot be empty.");
      }

      ranges.push({ start: rangeStart, end: text.length });
      rangeStart = null;
      continue;
    }

    text += character;
  }

  if (rangeStart !== null) {
    throw new DefinitionMarkupError("Definition ranges must be closed.");
  }

  const trimmedText = text.trim();
  const leadingWhitespace = text.length - text.trimStart().length;

  return {
    text: trimmedText,
    ranges: ranges.map((range) => ({
      start: range.start - leadingWhitespace,
      end: range.end - leadingWhitespace,
    })),
  };
}

export function normalizeDefinition(value: string) {
  return parseDefinitionMarkup(value).text.replace(/\s+/g, " ").toLowerCase();
}
