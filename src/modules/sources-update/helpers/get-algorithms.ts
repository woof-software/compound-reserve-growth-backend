/**
 * Parses PostgreSQL-style array literal "{a,b}" into string array ["a", "b"].
 * Trims whitespace around commas and element edges.
 */
function parsePgArrayLiteral(str: string): string[] {
  const inner = str.slice(1, -1).trim();
  if (inner === '') return [];
  return inner.split(',').map((s) => s.trim());
}

/**
 * Validates the algorithm field: must be an array with at least one non-empty value.
 * Accepts either a JSON array or a PostgreSQL-style string literal (e.g. "{timelock}" or "{a,b}").
 * For array input, data is not modified (no trim).
 */
export function getAlgorithms(value: unknown): string[] {
  let list: string[];

  if (Array.isArray(value)) {
    list = value.map((e) => String(e));
  } else if (typeof value === 'string' && /^\{.*\}$/.test(value)) {
    list = parsePgArrayLiteral(value);
  } else {
    throw new Error(`Source algorithm must be an array or "{...}" string, got ${typeof value}`);
  }

  if (list.length === 0) {
    throw new Error('Source algorithm must not be empty');
  }
  const hasNonEmpty = list.some((s) => s.trim() !== '');
  if (!hasNonEmpty) {
    throw new Error('Source algorithm must contain at least one non-empty value');
  }
  return list;
}
