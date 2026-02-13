/**
 * Stable keys for matching local DB entities with remote reserve data.
 * Used by asset and source update services for idempotent sync.
 */

export function getAssetKey(address: string, network: string): string {
  return `${network.toLowerCase()}:${address.toLowerCase()}`;
}

export function getSourceKey(
  address: string,
  network: string,
  algorithms: string[],
  assetAddress: string,
): string {
  const algoKey = [...algorithms]
    .map((a) => a.toLowerCase())
    .sort()
    .join('|');
  return `${network.toLowerCase()}:${address.toLowerCase()}:${algoKey}:${assetAddress.toLowerCase()}`;
}
