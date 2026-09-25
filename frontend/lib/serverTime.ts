/** Reads a server timestamp. Timestamps without a zone are UTC, so they get a `Z`. NaN when absent. */
export function parseServerTimestamp(value: string | null | undefined): number {
  if (!value) return NaN;
  return Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
}
