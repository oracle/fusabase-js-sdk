import { Utils } from "../util/utils.js";
import type { App } from "../../../app/src/public-types.js";
import { fusabaseFetch } from "../../../app/src/fusabase-fetch.js";

/**
 * Makes an HTTP request and returns the JSON response.
 *
 * @param params - Fetch request options (method, headers, body, etc.)
 * @param reqURL - The URL to send the request to
 * @param app - Application instance (used for logging)
 * @returns A Promise resolving to the parsed JSON response
 * @throws Error with status and message if the request fails
 */
export async function makeRequest<T = any>(
  params: RequestInit,
  reqURL: string,
  logLevel: number,
  app?: App
): Promise<T> {
  let response: Response | null = null;
  let result: T | null = null;

  try {
    response = await fusabaseFetch(app, reqURL, params);
    Utils.checkResponse(response);
    result = await response.json() as T;
  } catch (err: any) {
    Utils.baasTrace(logLevel, params, reqURL, response, result);

    if (response) {
      err.status = response.status;

      try {
        const newMessage = await response.json();
        if (Utils.memberExists(newMessage, "error")) {
          err.message = newMessage["error"];
        } else if (Utils.memberExists(newMessage, "message")) {
          err.message = newMessage["message"];
        }
      } catch {
        // response is not JSON text
        err.message = "Unknown";
      }
    }

    throw err;
  }

  return result as T;
}
