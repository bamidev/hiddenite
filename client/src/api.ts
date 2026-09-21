/**
 * Whenever an API call failed.
 */
class ApiCallError extends Error {
  response: Response;

  constructor(response: Response) {
    super(`Got response status: ${response.status} ${response.statusText}`);
    this.response = response;
  }
}

export default class Api {
  baseUrl: string;

  /**
   * @param baseUrl - The base of the URL for all the API requests
   */
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Perform the HTTP request with the given method.
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
   *
   * Perform a GET request.
   *
   * @param objectName - The object name
   * @param subPath - A subpath
   * @returns A promise
   */
  get(path: string = '') {
    return this._fetch('GET', path);
  }

  /**
   * Perform a PUT request.
   *
   * @param objectName - [TODO:description]
   * @param subPath - [TODO:description]
   * @returns [TODO:return]
   */
  put(path: string = '', body?: unknown) {
    return this._fetch('PUT', path, body);
  }

  /**
   * Perform a POST request.
   */
  post(path: string = '', body?: unknown) {
    return this._fetch('POST', path, body);
  }

  /**
   * Perform a DELETE request.
   */
  delete(path: string = '', body?: unknown) {
    return this._fetch('DELETE', path, body);
  }
}

// When serving the client through Vite's dev server, we need to point the API at the local instance of the server (using the default port).
// Make sure the add "http://localhost:5173" as one of the `baseUrls` in /etc/hiddenite/config.yaml, otherwise, you will get CORS issues. 
export const api = new Api(import.meta.env.DEV ? 'http://localhost:8484' : window.location.origin);
