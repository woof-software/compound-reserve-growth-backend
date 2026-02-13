/**
 * Validates the algorithm field: must be an array with at least one non-empty value.
 * Data is not modified (no trim). Rejects string values that look like DB array literals (e.g. "{a,b}").
 */
export function getAlgorithms(value: unknown): string[] {
  if (!Array.isArray(value)) {
    if (typeof value === 'string' && /^\{.*\}$/.test(value)) {
      throw new Error('Source algorithm must be a JSON array, not a string with braces');
    }
    throw new Error(`Source algorithm must be an array, got ${typeof value}`);
  }
  const list = value.map((e) => String(e));
  if (list.length === 0) {
    throw new Error('Source algorithm must not be empty');
  }
  const hasNonEmpty = list.some((s) => s.trim() !== '');
  if (!hasNonEmpty) {
    throw new Error('Source algorithm must contain at least one non-empty value');
  }
  return list;
}
