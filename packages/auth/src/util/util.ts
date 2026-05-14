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

import {LogLevel} from "../../../logger/LogLevel.js";
import { authErrorHandler, getErrorMessage, AuthError, ErrorCode, ErrorCodeMessage } from "../errors.js";
import { Auth } from "../types/auth.js";
import { UserCredential } from "../internal/credential.js";

/**
 * Parses an email action link and returns an ActionCodeURL if valid.
 *
 * @example
 * ```ts
 * import { parseActionCodeURL } from 'fusabase/auth';
 * const actionUrl = parseActionCodeURL('https://example.com/?oobCode=ABC123');
 * if (actionUrl) {
 *   console.log(actionUrl.operation);
 * }
 * ```
 *
 * @param link - The email action link to parse.
 * @returns An ActionCodeURL object if valid, otherwise null.
 */
// export declare function parseActionCodeURL(link: string): ActionCodeURL | null;

/**
 * Extracts provider-specific AdditionalUserInfo from a UserCredential.
 *
 * @example
 * ```ts
 * import { getAdditionalUserInfo } from 'fusabase/auth';
 * const userInfo = getAdditionalUserInfo(userCredential);
 * console.log(userInfo?.providerId);
 * ```
 *
 * @param userCredential - The UserCredential object from a sign-in or link operation.
 * @returns The AdditionalUserInfo object or null if unavailable.
 */
export declare function getAdditionalUserInfo(
  userCredential: UserCredential
): any | null;

/**
 * Connects the Auth instance to a local Fusabase Authentication emulator.
 *
 * @example
 * ```ts
 * import { getAuth, useAuthEmulator } from 'fusabase/auth';
 * const auth = getAuth();
 * useAuthEmulator(auth, 'http://localhost:9099');
 * ```
 *
 * @param auth - The Auth instance.
 * @param url - URL of the emulator, e.g., "http://localhost:9099".
 * @param options - Optional settings such as disabling warnings.
 */
export declare function useAuthEmulator(
  auth: Auth,
  url: string,
  options?: { disableWarnings?: boolean }
): void;

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
    const sensitiveKeys = [
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
    ];
    return sensitiveKeys.includes(normalizedKey);
  }

  private static redactLogString(value: string): string {
    const trimmed = value.trim();

    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return JSON.stringify(Utils.redactLogValue(JSON.parse(value)));
      } catch (_err) {
        // Fall through to pattern based redaction for non-JSON strings.
      }
    }

    return value
      .replace(/(authorization\s*[:=]\s*)(bearer|basic)\s+[^&\s,"'}]+/gi, `$1$2 ${Utils.LOG_REDACTION}`)
      .replace(/(\b(?:access_token|refresh_token|id_token|idToken|authnToken|token|assertion|password|client_secret|clientSecret|apiKey|appCheckToken|code_verifier|codeVerifier)\b\s*[:=]\s*)[^&\s,"'}]+/gi, `$1${Utils.LOG_REDACTION}`)
      .replace(/([?&](?:access_token|refresh_token|id_token|token|assertion|password|client_secret|apiKey|appCheckToken|code|code_verifier)=)[^&#\s]+/gi, `$1${Utils.LOG_REDACTION}`)
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, Utils.LOG_REDACTION);
  }

  private static redactLogValue(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
    if (value == null) {
      return value;
    }

    if (typeof value === "string") {
      return Utils.redactLogString(value);
    }

    if (typeof value !== "object") {
      return value;
    }

    if (seen.has(value)) {
      return "[Circular]";
    }

    if (depth >= Utils.MAX_LOG_DEPTH) {
      return "[MaxDepth]";
    }

    seen.add(value);

    if (value instanceof Error) {
      const errorResult: Record<string, unknown> = {
        name: value.name,
        message: Utils.redactLogString(value.message),
      };
      const maybeStatus = (value as { status?: unknown }).status;
      if (maybeStatus != null) {
        errorResult.status = maybeStatus;
      }
      const maybeCode = (value as { code?: unknown }).code;
      if (maybeCode != null) {
        errorResult.code = Utils.redactLogValue(maybeCode, seen, depth + 1);
      }
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
      const headers: Record<string, unknown> = {};
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

    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = Utils.isSensitiveLogKey(key)
        ? Utils.LOG_REDACTION
        : Utils.redactLogValue(nestedValue, seen, depth + 1);
    }
    return result;
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
  static parseJWT(token: string) : any {
    let baseURL = token.split(".")[1];
    var base64 = baseURL.replace(/-/g, "+").replace(/_/g, "/");
    var jsonData = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
    return JSON.parse(jsonData);
  }

  /**
   * Checks if the returned response has a valid status code (200–299).
   * Throws an error if the status code isn't in the specified range.
   *
   * @param response - Fetch API response object
   * @throws Error with `status` if response is not ok
   */
  /**
   * @internal
   */
  static checkResponse(response: Response): void {
    if (!response) {
      const error: any = new Error("Request failed");
      error.status = 408;
      throw error;
    }
    if (!response.ok) {
      const error: any = new Error(response.statusText);
      error.status = response.status;
      throw error;
    }
  }

  /**
   * Prints a trace of the request and the function stack if log level is ERROR.
   *
   * @param logLevel - Logging level
   * @param data - Data to trace
   */
  /**
   * @internal
   */
  static baasTrace(logLevel: LogLevel, ...data: unknown[]): void {
    if (logLevel === LogLevel.ERROR) {
      for (let i = 0; i < data.length; i++) {
        console.trace(Utils.redactLogValue(data[i]));
      }
    }
  }

  /**
   * Logs redacted data to the console if log level is ERROR.
   *
   * @param logLevel - Logging level
   * @param data - Data to log
   */
  /**
   * @internal
   */
  static baasLogger(logLevel: LogLevel, ...data: unknown[]): void {
    if (logLevel === LogLevel.ERROR) {
      for (let i = 0; i < data.length; i++) {
        console.log(Utils.redactLogValue(data[i]));
      }
    }
  }

  /**
   * Safely retrieves a nested property from an object using a `#FieldPath#` separator.
   *
   * @param object - Object to traverse
   * @param path - Path string with `#FieldPath#` separators
   * @returns The property value if found, otherwise undefined
   */
  /**
   * @internal
   */
  static getObjectProperty(object: any, path: string): unknown {
    if (object == null) {
      return object;
    }
    const parts = path.split("#FieldPath#");
    for (let i = 0; i < parts.length; ++i) {
      if (object == null) {
        return undefined;
      }
      let key: string | number = parts[i];
      if (key.length > 14 && key.startsWith("__fusabaseindex__")) {
        key = key.substring(14);
        key = parseInt(key, 10);
      }
      object = object[key];
    }
    return object;
  }

  /**
   * Checks if an object contains a given member.
   *
   * @param obj - The object to check
   * @param member - The property name
   * @returns True if the member exists, false otherwise
   */
  /**
   * @internal
   */
  static memberExists(obj: Record<string, unknown>, member: string): boolean {
    return Object.prototype.hasOwnProperty.call(obj, member);
  }

  /**
   * Checks if an object is an instance of a given class.
   *
   * @param obj - The object to check
   * @param classname - The class constructor
   * @returns True if obj is an instance of classname
   */
  /**
   * @internal
   */
  static isTypeOf<T>(obj: unknown, classname: new (...args: any[]) => T): obj is T {
    return obj instanceof classname;
  }

  /**
   * Checks if a value is numeric (string containing a number or a number type).
   *
   * @param value - The value to check
   * @returns True if value is numeric, false otherwise
   */
  /**
   * @internal
   */
  static isNumber(value: unknown): boolean {
    if (typeof value === "string") {
      return !isNaN(Number(value));
    }
    return typeof value === "number" && !isNaN(value);
  }
}

/**
 * @internal
 */
export function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    );
  } catch (error) {
    return '';
  }
}

/**
   * @internal
   */
export function customMod(value: number | bigint, modulus: number | bigint): bigint {
  if (typeof value !== 'number' && typeof value !== 'bigint') {
    let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, {message: getErrorMessage('INVALID_TYPE_PARAM', 'input type for value', 'number or bigint', typeof value)});
    error.status = ErrorCode.INVALID_ARGS;
    throw authErrorHandler(error);
  }
  if (typeof modulus !== 'number' && typeof modulus !== 'bigint') {
    let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, {message: getErrorMessage('INVALID_TYPE_PARAM', 'input type for modulus', 'number or bigint', typeof modulus)});
    error.status = ErrorCode.INVALID_ARGS;
    throw authErrorHandler(error);
  }
  if (modulus === 0 || BigInt(modulus) === BigInt(0)) {
    let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, {message: getErrorMessage('INVALID_PARAM', 'modulus (cannot be zero)')});
    error.status = ErrorCode.INVALID_ARGS;
    throw authErrorHandler(error);
  }

  const bigValue = BigInt(value);
  const bigModulus = BigInt(modulus);
  let result = bigValue % bigModulus;
  if (result < BigInt(0)) {
    result += bigModulus;
  }
  return result;
}

/**
 * @internal
 */
// Function to perform modular exponentiation
export function modPow(base: number | bigint, exponent: number | bigint, modulus: number | bigint): bigint {
  if (BigInt(modulus) === BigInt(1)) return BigInt(0);
  let result = BigInt(1);

  base = customMod(base, modulus);
  while (BigInt(exponent) > BigInt(0)) {
    if (customMod(exponent, BigInt(2)) === BigInt(1)) {
      result = customMod(BigInt(result) * BigInt(base), modulus);
    }
    exponent = BigInt(exponent) >> BigInt(1);
    base = customMod(BigInt(base) * BigInt(base), modulus);
  }
  return result;
}

/**
 * @internal
 */
export function convertIatToTimestamp(timestamp: number): string {
  if (typeof timestamp !== 'number' || isNaN(timestamp)) {
    let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, {message: getErrorMessage('INVALID_TYPE_PARAM', 'timestamp', 'number', typeof timestamp)});
    error.status = ErrorCode.INVALID_ARGS;
    throw authErrorHandler(error);
  }

  const date = new Date(timestamp * 1000);
  if (isNaN(date.getTime())) {
    let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, {message: getErrorMessage('INVALID_PARAM', 'date')});
    error.status = ErrorCode.INVALID_ARGS;
    throw authErrorHandler(error);
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');
  const microseconds = '000000';

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${microseconds}`;
}

/**
 * @internal
 */
export function convertOCITimeToTimestampString(timestampString: string): string {
  if (typeof timestampString !== 'string') {
    let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, {message: getErrorMessage('INVALID_TYPE_PARAM', 'timestampString', 'string', typeof timestampString)});
    error.status = ErrorCode.INVALID_ARGS;
    throw authErrorHandler(error);
  }

  const date = new Date(timestampString);
  if (isNaN(date.getTime())) {
    let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, {message: getErrorMessage('INVALID_PARAM', 'date')});
    error.status = ErrorCode.INVALID_ARGS;
    throw authErrorHandler(error);
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');
  const microseconds = '000000';

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${microseconds}`;
}
