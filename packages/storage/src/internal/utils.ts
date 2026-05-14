// Copyright 2025 Fusabase SDK Authors. All Rights Reserved.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


import { StorageError, StorageErrorCode } from "../errors.js";
import { LogLevel } from "../../../logger/LogLevel.js";
import { eventMap, TaskEvent } from "../types.js";
import { fusabaseFetch } from "../../../app/src/fusabase-fetch.js";

/**
 * Internal class for CustomEvent.
 */
/**
 * @internal
 */
export class CustomEvent extends Event {
  /**
   * @internal
   */
  detail: any;

  constructor(message: TaskEvent, data: any) {
    super(eventMap[message]);
    this.detail = data.detail;
  }
}

/**
 * @internal
 */
export async function getAccessToken(app: any): Promise<string | null> {
  return app.auth().currentUser && app.auth().currentUser.getFUSABASEToken
    ? await app.auth().currentUser.getFUSABASEToken()
    : null;
}

/**
 * @internal
 */
export function isValidMetadata(obj: any): boolean {
  if (typeof obj !== "object" || obj === null) return false;
  const keys = Object.keys(obj);
  const hasOtherKeys = keys.some((key) => key !== "contentType");
  const contentTypeIsValid =
    !Object.prototype.hasOwnProperty.call(obj, "contentType") || typeof obj.contentType === "string";
  return !hasOtherKeys && contentTypeIsValid;
}

/**
 * @internal
 */
export function fetchWithRetry(
  url: string,
  options: any,
  maxRetryTime: number,
  app?: any
): Promise<Response> {
  const start = Date.now();
  const delay = 200;

  return new Promise((resolve, reject) => {
    function fetchWithDelay() {
      fusabaseFetch(app, url, options)
        .then((response) => resolve(response))
        .catch((err) => {
          if (Date.now() - start > maxRetryTime) {
            reject(err);
          } else {
            // possibility of too many requests - add a delay
            // TODO: replace with exponential Backoff
            setTimeout(fetchWithDelay, delay);
          }
        });
    }
    fetchWithDelay();
  });
}

/**
 * Internal class for providing utility functions to all the classes.
 */
/**
 * @internal
 */
export class Utils {
  private static readonly LOG_REDACTION = "[REDACTED]";
  private static readonly MAX_LOG_DEPTH = 6;

  private static isSensitiveLogKey(key: string): boolean {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    return [
      "accesstoken",
      "refreshtoken",
      "idtoken",
      "inttoken",
      "authntoken",
      "fusabasetoken",
      "token",
      "password",
      "oldpassword",
      "newpassword",
      "secret",
      "clientsecret",
      "credential",
      "credentials",
      "authorization",
      "xauthz",
      "xauthtoken",
      "cookie",
      "setcookie",
      "assertion",
      "signature",
      "codeverifier",
      "apikey",
      "appchecktoken",
    ].includes(normalizedKey);
  }

  private static redactLogString(value: string): string {
    const trimmed = value.trim();

    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return JSON.stringify(Utils.redactLogValue(JSON.parse(value)));
      } catch {
        // Fall through to pattern based redaction for non-JSON strings.
      }
    }

    return value
      .replace(/(authorization\s*[:=]\s*)(bearer|basic)\s+[^&\s,"'}]+/gi, `$1$2 ${Utils.LOG_REDACTION}`)
      .replace(/(\b(?:access_token|refresh_token|id_token|idToken|authnToken|token|assertion|password|client_secret|clientSecret|apiKey|appCheckToken|code_verifier|codeVerifier)\b\s*[:=]\s*)[^&\s,"'}]+/gi, `$1${Utils.LOG_REDACTION}`)
      .replace(/([?&](?:access_token|refresh_token|id_token|token|assertion|password|client_secret|apiKey|appCheckToken|code|code_verifier)=)[^&#\s]+/gi, `$1${Utils.LOG_REDACTION}`)
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, Utils.LOG_REDACTION);
  }

  private static redactLogValue(value: any, seen = new WeakSet<object>(), depth = 0): any {
    if (value == null) return value;
    if (typeof value === "string") return Utils.redactLogString(value);
    if (typeof value !== "object") return value;
    if (seen.has(value)) return "[Circular]";
    if (depth >= Utils.MAX_LOG_DEPTH) return "[MaxDepth]";

    seen.add(value);

    if (value instanceof Error) {
      const errorResult: Record<string, any> = {
        name: value.name,
        message: Utils.redactLogString(value.message),
      };
      if ((value as any).status != null) errorResult.status = (value as any).status;
      if ((value as any).code != null) errorResult.code = Utils.redactLogValue((value as any).code, seen, depth + 1);
      return errorResult;
    }

    if (typeof Response !== "undefined" && value instanceof Response) {
      return {
        type: value.type,
        url: Utils.redactLogString(value.url),
        status: value.status,
        ok: value.ok,
        statusText: value.statusText,
        redirected: value.redirected,
      };
    }

    if (typeof Request !== "undefined" && value instanceof Request) {
      return {
        method: value.method,
        url: Utils.redactLogString(value.url),
        credentials: value.credentials,
        mode: value.mode,
      };
    }

    if (typeof Headers !== "undefined" && value instanceof Headers) {
      const headers: Record<string, any> = {};
      value.forEach((headerValue, headerKey) => {
        headers[headerKey] = Utils.isSensitiveLogKey(headerKey)
          ? Utils.LOG_REDACTION
          : Utils.redactLogString(headerValue);
      });
      return headers;
    }

    if (Array.isArray(value)) {
      return value.map((item) => Utils.redactLogValue(item, seen, depth + 1));
    }

    const result: Record<string, any> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = Utils.isSensitiveLogKey(key)
        ? Utils.LOG_REDACTION
        : Utils.redactLogValue(nestedValue, seen, depth + 1);
    }
    return result;
  }

  /**
   * @static
   * @property {Function} baasTrace
   * Get the trace of the request and the function stack.
   * @param {Object} data
   */
  /**
   * @internal
   */
  static baasTrace(logLevel: LogLevel, ...data: any[]) {
    if (logLevel === LogLevel.ERROR) {
      for (let i = 0; i < data.length; i++) {
        console.trace(Utils.redactLogValue(data[i]));
      }
    }
  }

  /**
   * @static
   * @property {Function} checkResponse
   * Checks if the returned response has status code >= 200 & <= 299.
   * Throws error if the status code isn't in the specified range.
   * @param {Object} response
   */
  /**
   * @internal
   */
  static checkResponse(response: Response) {
    if (!response) {
      const error: any = new Error("Request failed");
      error.status = 408;
      throw error;
    }

if (!response.ok) {
  let code: StorageErrorCode;
  if (response.status === 401) {
    code = StorageErrorCode.UNAUTHENTICATED;
  } else if (response.status === 403) {
    code = StorageErrorCode.UNAUTHORIZED;
  } else if (response.status === 404) {
    code = StorageErrorCode.OBJECT_NOT_FOUND;
  } else {
    code = StorageErrorCode.UNKNOWN;
  }
  const error = new StorageError(code, response.statusText);
  (error as any).status = response.status;
  throw error;
}
  }

  /**
   * @static
   * @property {Function} baasLogger
   * Log redacted data to the console if ERROR.
   * @param {T} data
   */
  /**
 * @internal
 */
  static baasLogger(logLevel: LogLevel, ...data: any[]) {
    if (logLevel === LogLevel.ERROR) {
      for (let i = 0; i < data.length; i++) {
        console.log(Utils.redactLogValue(data[i]));
      }
    }
  }

  /**
   * @static
   * @property {Function} parseJWT
   * Parses the content of the JWT token's body.
   * @returns {Object} JWT Token's content in json.
   */
  /**
 * @internal
 */
  static parseJWT(token: string): any {
    let baseURL = token.split(".")[1];
    var base64 = baseURL.replace(/-/g, "+").replace(/_/g, "/");
    var jsonData = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
    return JSON.parse(jsonData);
  }
}
