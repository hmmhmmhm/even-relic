function hudUnits(value: string): number {
  return [...value].reduce(
    (total, character) =>
      total + (/^[\x00-\x7f]$/.test(character) ? 1 : 2),
    0,
  );
}

function prefixLength(value: string, maxUnits: number): number {
  let used = 0;
  let length = 0;
  for (const character of value) {
    const units = /^[\x00-\x7f]$/.test(character) ? 1 : 2;
    if (used + units > maxUnits) break;
    used += units;
    length += 1;
  }
  return length;
}

function truncatedLine(value: string, maxUnits: number): string {
  const ellipsisUnits = 2;
  if (maxUnits < ellipsisUnits) return "";
  const characters = [...value];
  const length = prefixLength(value, maxUnits - ellipsisUnits);
  return `${characters.slice(0, length).join("").trimEnd()}…`;
}

export function wrapHudText(
  value: string,
  maxUnits: number,
  maxLines: number,
): readonly string[] {
  let remaining = value.replace(/\s+/g, " ").trim();
  if (!remaining || maxUnits <= 0 || maxLines <= 0) return [];

  const lines: string[] = [];
  while (remaining && lines.length < maxLines) {
    if (hudUnits(remaining) <= maxUnits) {
      lines.push(remaining);
      break;
    }
    if (lines.length === maxLines - 1) {
      const line = truncatedLine(remaining, maxUnits);
      if (line) lines.push(line);
      break;
    }

    const characters = [...remaining];
    const length = prefixLength(remaining, maxUnits);
    const candidate = characters.slice(0, length).join("");
    const wordBoundary = candidate.lastIndexOf(" ");
    const nextIsBoundary = characters[length] === " ";
    const breakAt = nextIsBoundary
      ? length
      : wordBoundary > 0
        ? [...candidate.slice(0, wordBoundary)].length
        : length;
    const line = characters.slice(0, breakAt).join("").trim();
    if (line) lines.push(line);
    remaining = characters.slice(
      nextIsBoundary || wordBoundary > 0 ? breakAt + 1 : breakAt,
    ).join("").trimStart();
  }
  return lines;
}

function measuredPrefixLength(
  value: string,
  measure: (value: string) => number,
  maxWidth: number,
): number {
  const characters = [...value];
  let length = 0;
  for (let index = 1; index <= characters.length; index += 1) {
    if (measure(characters.slice(0, index).join("")) > maxWidth) break;
    length = index;
  }
  return length;
}

function measuredTruncatedLine(
  value: string,
  measure: (value: string) => number,
  maxWidth: number,
): string {
  const ellipsis = "…";
  if (measure(ellipsis) > maxWidth) return "";
  const characters = [...value];
  let length = 0;
  for (let index = 1; index <= characters.length; index += 1) {
    const candidate = `${characters.slice(0, index).join("").trimEnd()}${ellipsis}`;
    if (measure(candidate) > maxWidth) break;
    length = index;
  }
  return `${characters.slice(0, length).join("").trimEnd()}${ellipsis}`;
}

export function wrapHudTextByWidth(
  value: string,
  measure: (value: string) => number,
  maxWidth: number,
  maxLines: number,
): readonly string[] {
  let remaining = value.replace(/\s+/g, " ").trim();
  if (!remaining || maxWidth <= 0 || maxLines <= 0) return [];

  const lines: string[] = [];
  while (remaining && lines.length < maxLines) {
    if (measure(remaining) <= maxWidth) {
      lines.push(remaining);
      break;
    }
    if (lines.length === maxLines - 1) {
      const line = measuredTruncatedLine(remaining, measure, maxWidth);
      if (line) lines.push(line);
      break;
    }

    const characters = [...remaining];
    const length = measuredPrefixLength(remaining, measure, maxWidth);
    if (length <= 0) break;
    const candidate = characters.slice(0, length).join("");
    const wordBoundary = candidate.lastIndexOf(" ");
    const nextIsBoundary = characters[length] === " ";
    const breakAt = nextIsBoundary
      ? length
      : wordBoundary > 0
        ? [...candidate.slice(0, wordBoundary)].length
        : length;
    const line = characters.slice(0, breakAt).join("").trim();
    if (line) lines.push(line);
    remaining = characters.slice(
      nextIsBoundary || wordBoundary > 0 ? breakAt + 1 : breakAt,
    ).join("").trimStart();
  }
  return lines;
}
