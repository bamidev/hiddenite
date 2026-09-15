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
    const response = await fetch(`${this.baseUrl}/${path}`, {
      method: method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
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
}

export const api = new Api('http://localhost:3000');
