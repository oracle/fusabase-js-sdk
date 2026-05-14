// Copyright (c) 2015, 2026, Oracle and/or its affiliates.

//-----------------------------------------------------------------------------
//
// This software is dual-licensed to you under the Universal Permissive License
// (UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl and Apache License
// 2.0 as shown at http://www.apache.org/licenses/LICENSE-2.0. You may choose
// either license.
//
// If you elect to accept the software under the Apache License, Version 2.0,
// the following applies:
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
//-----------------------------------------------------------------------------
// 

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
