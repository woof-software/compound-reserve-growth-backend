export function scaleToDecimals(scale: bigint | string | number): number {
  const s = BigInt(scale).toString();
  return s.length - 1;
}
