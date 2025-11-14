import { randomBytes } from 'crypto';

/**
 * Generate a random 12-character URL-safe key
 */
export function generateSecretKey(length = 12): string {
  const entropyBytes = Math.ceil((length * 6) / 8);
  const raw = randomBytes(entropyBytes).toString('base64url');
  return raw.slice(0, length);
}
