function hudUnits(value: string): number {
  return [...value].reduce(
    (total, character) =>
      total + (/^[\x00-\x7F]$/.test(character) ? 1 : 2),
    0,
  );
}

export function truncateHudTitle(title: string, maxUnits: number): string {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (hudUnits(normalized) <= maxUnits) return normalized;
  const ellipsisUnits = 2;
  let output = "";
  let used = 0;
  for (const character of normalized) {
    const units = /^[\x00-\x7F]$/.test(character) ? 1 : 2;
    if (used + units + ellipsisUnits > maxUnits) break;
    output += character;
    used += units;
  }
  return `${output.trimEnd()}…`;
}
