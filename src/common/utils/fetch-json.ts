import type { AxiosInstance } from 'axios';
import { ServiceUnavailableException } from '@nestjs/common';

/**
 * GET url as JSON and return response data.
 * Throws if status is not 2xx.
 */
export async function fetchJson<T>(http: AxiosInstance, url: string): Promise<T> {
  const response = await http.get<T>(url, { responseType: 'json' });
  const ok = response.status >= 200 && response.status < 300;
  if (!ok) {
    throw new ServiceUnavailableException(
      `HTTP error: ${response.status} ${response.statusText} (${url})`,
    );
  }
  return response.data;
}
