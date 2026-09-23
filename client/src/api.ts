/**
 * Thin wrapper around `fetch` for talking to the Hiddenite server: builds request URLs
 * relative to a base URL, serializes JSON/FormData bodies, and throws on non-OK responses.
 * Also exports a shared `api` singleton pointed at the correct base URL for the current
 * environment (Vite dev server vs. production).
 */

/**
 * Thrown by {@link Api} methods whenever the underlying `fetch` call resolves with a
 * non-OK response status.
 */
class ApiCallError extends Error {
  response: Response;

  constructor(response: Response) {
    super(`Got response status: ${response.status} ${response.statusText}`);
    this.response = response;
  }
}

/**
 * A small HTTP client for the Hiddenite server API. Wraps `fetch` with a configurable
 * base URL, automatic JSON/FormData body encoding, and error throwing on failed requests.
 */
export default class Api {
  baseUrl: string;

  /**
   * @param baseUrl - The base of the URL for all the API requests
   */
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Perform the HTTP request with the given method. Serializes `body` as JSON unless it is
   * already a `FormData` instance, in which case it is sent as-is (letting the browser set
   * the multipart content type).
   *
   * @param method - The HTTP method to use (e.g. 'GET', 'PUT', 'POST', 'DELETE').
   * @param path - The path to request, relative to `baseUrl`.
   * @param body - Optional request body. Plain values are JSON-encoded; `FormData` is sent unmodified.
   * @returns The resolved `Response`.
   * @throws {ApiCallError} If the response status indicates failure.
   */
  async _fetch(method: string, path: string, body?: unknown) {
    const isFormData = body instanceof FormData;
    const response = await fetch(`${this.baseUrl}/${path}`, {
      method: method,
      headers: body === undefined || isFormData ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : (isFormData ? body : JSON.stringify(body)),
    });
    // Raise an exception if the response status indicates failure
    if (!response.ok) {
      throw new ApiCallError(response);
    }
    return response;
  }

  /**
   * Perform a GET request.
   *
   * @param path - The path to request, relative to `baseUrl`. Defaults to the base URL itself.
   * @returns A promise resolving to the `Response`.
   */
  get(path: string = '') {
    return this._fetch('GET', path);
  }

  /**
   * Perform a PUT request.
   *
   * @param path - The path to request, relative to `baseUrl`. Defaults to the base URL itself.
   * @param body - Optional request body, JSON-encoded unless it is `FormData`.
   * @returns A promise resolving to the `Response`.
   */
  put(path: string = '', body?: unknown) {
    return this._fetch('PUT', path, body);
  }

  /**
   * Perform a POST request.
   *
   * @param path - The path to request, relative to `baseUrl`. Defaults to the base URL itself.
   * @param body - Optional request body, JSON-encoded unless it is `FormData`.
   * @returns A promise resolving to the `Response`.
   */
  post(path: string = '', body?: unknown) {
    return this._fetch('POST', path, body);
  }

  /**
   * Perform a DELETE request.
   *
   * @param path - The path to request, relative to `baseUrl`. Defaults to the base URL itself.
   * @param body - Optional request body, JSON-encoded unless it is `FormData`.
   * @returns A promise resolving to the `Response`.
   */
  delete(path: string = '', body?: unknown) {
    return this._fetch('DELETE', path, body);
  }
}

// When serving the client through Vite's dev server, we need to point the API at the local instance of the server (using the default port).
// Make sure the add "http://localhost:5173" as one of the `baseUrls` in /etc/hiddenite/config.yaml, otherwise, you will get CORS issues. 
export const api = new Api(import.meta.env.DEV ? 'http://localhost:8484' : window.location.origin);
