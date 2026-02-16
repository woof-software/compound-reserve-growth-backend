import type { AxiosInstance } from 'axios';

/**
 * GET url as JSON and return response data.
 * Axios rejects on non-2xx by default, so errors propagate as AxiosError.
 */
export async function fetchJson<T>(http: AxiosInstance, url: string): Promise<T> {
  const response = await http.get<T>(url, { responseType: 'json' });
  return response.data;
}
