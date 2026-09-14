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
  async _fetch(method: string, objectName: string, subPath: string) {
    const response = await fetch(`${this.baseUrl}/${objectName}/${subPath}`, {
      method: method,
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
  get(objectName: string, subPath: string = '') {
    return this._fetch('GET', objectName, subPath);
  }

  /**
   * Perform a PUT request.
   *
   * @param objectName - [TODO:description]
   * @param subPath - [TODO:description]
   * @returns [TODO:return]
   */
  put(objectName: string, subPath: string = '') {
    return this._fetch('PUT', objectName, subPath);
  }
}
