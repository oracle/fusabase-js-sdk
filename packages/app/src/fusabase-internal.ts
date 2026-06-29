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

import { FusabaseError } from "./errors.js";
import { App, FusabaseOptions } from "./public-types.js"; // your options interface
import {LogLevel} from "../../logger/LogLevel.js";
import { getOrCreateBrowserInstanceId } from './instance-id.js';
import {
  DEFAULT_LONG_POLLING_TIMEOUT_SECONDS,
  validateLongPollingTimeoutSeconds
} from "../../oracledb/src/internal/settings.js";

// Error type with HTTP-like status
interface ErrorWithStatus extends Error {
  status?: number;
}

// typeStrings for argCheck
const typeStrings = Object.freeze({
  NULL: "null",
  ARRAY: "array",
  DATE: "date",
  REGEXP: "regexp",
  NUMBER: "number",
  INT: "int",
  FLOAT: "float",
  OBJECT: "object",
  STRING: "string",
  BOOL: "boolean",
  BIGINT: "bigint",
  SYMBOL: "symbol",
  FUNCTION: "function",
} as const);

/**
 * Map of validation and configuration error messages.
 */
export const errorMessages = {
  invalidOrdsHost: 'Invalid ords host',
  invalidSchema: 'Invalid schema',
  invalidAppId: 'Invalid app id',
  invalidProjectId: 'Invalid project id',
  invalidObjsType: 'Invalid objs type',
  invalidStorageBucket: 'Invalid storage bucket',
  invalidAuthType: 'Invalid auth type',
  invalidAuthId: 'Invalid auth id',
  invalidDomainUrl: 'Invalid domain url',
  invalidClientId: 'Invalid client id',
  invalidClientCreds: 'Invalid client creds',
  invalidSelfRegistrationProfile: 'Invalid self registration profile',
  invalidSocketValue: 'Invalid socket value',
  invalidPollingInterval: 'Invalid polling interval',
  invalidOracledbVersion: 'Invalid oracledb version',
  invalidChunkSize: 'Invalid chunk size',
  invalidMaxUploadBytes: 'Invalid max upload bytes',
  appNotInitialized: 'App is not initialized. Use initializeApp() first.',
  valueCannotBeNull: 'Value cannot be null or undefined',
  typeMismatch: 'Expected one of [%expected%] but got %actual%',
} as const;

export type ErrorMessageKey = keyof typeof errorMessages;

/**
 * Replaces placeholders in the form [%key%] within a message template.
 *
 * @param template - The message template (e.g., 'Expected one of [%expected%] but got %actual%')
 * @param params - Key-value pairs to replace placeholders (e.g., { expected: 'string', actual: 'number' })
 * @returns The formatted message.
 */
export function formatMessage(
  template: string,
  params: Record<string, string>
): string {
  return template.replace(/\[%(\w+)%\]/g, (match, key) => {
    return key in params ? params[key] : match;
  });
}

/**
 * Retrieves and formats an error message by key.
 *
 * @param key - The key from `errorMessages`.
 * @param params - Optional parameters for placeholder substitution.
 * @returns The formatted error message.
 */
export function getErrorMessage(
  key: ErrorMessageKey,
  params: Record<string, string> = {}
): string {
  const template = errorMessages[key];
  return formatMessage(template, params);
}


// app error handler
function appErrorHandler(err: ErrorWithStatus): FusabaseError {
  let code: string;

  if (err.status === 400) code = "invalid-argument";
  else if (err.status === 401) code = "unauthenticated";
  else if (err.status === 404) code = "not-found";
  else if (err.status === 403) code = "permission-denied";
  else if (err.status === 500) code = "internal";
  else code = "unknown";

  return new FusabaseError(code, err.message, err.stack);
}

// Argument checker utility
function argCheck<T>(
  value: T,
  message: string,
  throwNullError: boolean,
  expectedTypes: string[] = []
): T {
    if (value === null || value === undefined) {
      if (!throwNullError) {
        return value;
      }
      const error = new Error(message || getErrorMessage('valueCannotBeNull')) as ErrorWithStatus;
      error.status = 400;
      throw appErrorHandler(error);
    }

  if (!Array.isArray(expectedTypes) || expectedTypes.length === 0) {
    return value;
  }

  function detectType(val: unknown): string {
    if (val === null) return typeStrings.NULL;
    if (Array.isArray(val)) return typeStrings.ARRAY;
    if (val instanceof Date) return typeStrings.DATE;
    if (val instanceof RegExp) return typeStrings.REGEXP;
    if (typeof val === typeStrings.NUMBER) {
      return Number.isInteger(val) ? typeStrings.INT : typeStrings.FLOAT;
    }
    if (typeof val === "object") return typeStrings.OBJECT;
    return typeof val; // string, boolean, bigint, symbol, function
  }

  const actualType = detectType(value);

  if (!expectedTypes.map((t) => t.toLowerCase()).includes(actualType)) {
    const error = new Error(
      message || getErrorMessage('typeMismatch', { expected: expectedTypes.join(", "), actual: actualType })
    ) as ErrorWithStatus;
    error.status = 400;
    throw appErrorHandler(error);
  }

  return value;
}

function getConfiguredLongPollingInterval(options: Record<string, any>): number {
  if (!Object.prototype.hasOwnProperty.call(options, "long_polling_interval")) {
    return DEFAULT_LONG_POLLING_TIMEOUT_SECONDS;
  }

  try {
    return validateLongPollingTimeoutSeconds(options["long_polling_interval"]);
  } catch (err) {
    throw appErrorHandler(err as ErrorWithStatus);
  }
}

// -------------------- SOBa Core Object --------------------
const fusabase = {

  _apps: {} as Record<string, App>,

  get apps(): App[] {
    const appsArr: App[] = [];
    Object.entries(this._apps).forEach(([_, value]) => {
        appsArr.push(value as App);
    });
    return appsArr;
    },


  initializeApp(options_sdk: Record<string, any>, name: string = "[DEFAULT]"): App {
    argCheck(options_sdk["ords_host"], getErrorMessage('invalidOrdsHost'), true, [typeStrings.STRING]);
    argCheck(options_sdk["schema"], getErrorMessage('invalidSchema'), true, [typeStrings.STRING]);
    argCheck(options_sdk["app_id"], getErrorMessage('invalidAppId'), true, [typeStrings.STRING]);
    argCheck(options_sdk["project_id"], getErrorMessage('invalidProjectId'), true, [typeStrings.STRING]);
    argCheck(options_sdk["objs_type"], getErrorMessage('invalidObjsType'), true, [typeStrings.STRING]);
    argCheck(options_sdk["storage_bucket"], getErrorMessage('invalidStorageBucket'), true, [typeStrings.STRING]);
    argCheck(options_sdk["auth_type"], getErrorMessage('invalidAuthType'), true, [typeStrings.STRING]);
    argCheck(options_sdk["app_type"], "Invalid app type", true, [typeStrings.STRING]);

    argCheck(options_sdk["auth_id"], getErrorMessage('invalidAuthId'), true, [typeStrings.STRING]);
    if (String(options_sdk["auth_type"]).toLowerCase() === "idcs") {
      argCheck(options_sdk["idcs_domain_url"], "Invalid IDCS domain URL", true, [typeStrings.STRING]);
    }

    argCheck(options_sdk["use_socket"], getErrorMessage('invalidSocketValue'), false, [typeStrings.BOOL]);
    argCheck(options_sdk["long_polling_interval"], getErrorMessage('invalidPollingInterval'), false, [typeStrings.INT]);
    argCheck(options_sdk["version"], getErrorMessage('invalidOracledbVersion'), false, [typeStrings.INT]);
    argCheck(options_sdk["upload_chunk_size"], getErrorMessage('invalidChunkSize'), false, [typeStrings.INT]);
    argCheck(options_sdk["max_upload_bytes"], getErrorMessage('invalidMaxUploadBytes'), false, [typeStrings.INT]);

    const longPollingInterval = getConfiguredLongPollingInterval(options_sdk);

    const options: FusabaseOptions = {
      ordsHost: options_sdk["ords_host"],
      schema: options_sdk["schema"],
      appType: String(options_sdk["app_type"]).toLowerCase(),
      appID: options_sdk["app_id"],
      projectID: options_sdk["project_id"],
      objsType: options_sdk["objs_type"].toLowerCase(),
      storageBucket: options_sdk["storage_bucket"],
      authType: options_sdk["auth_type"].toLowerCase(),
      authID: options_sdk["auth_id"],
      idcsDomainURL: options_sdk["idcs_domain_url"],
      useSocket: options_sdk["use_socket"] === true ? options_sdk["use_socket"] : false,
      longPollingInterval,
      version: options_sdk["version"] ? options_sdk["version"] : 2,
      appTrustToken: options_sdk["appTrustToken"] ? options_sdk["appTrustToken"] : null,
      chunkSize: options_sdk["upload_chunk_size"] ? options_sdk["upload_chunk_size"] : 16 * 1024 * 1024,
      maxUploadBytes: options_sdk["max_upload_bytes"],
    };

    if (typeof options_sdk["appTrustToken"] === 'string' && options_sdk["appTrustToken"]) {
      (options as any).appTrustToken = options_sdk["appTrustToken"];
    }

    const appInstance = new App(options, name);

    try {
      (appInstance as any)._instanceId = getOrCreateBrowserInstanceId();
    } catch {
      // ignore
    }

    appInstance._intializeAfterConfig();
    fusabase._apps[name] = appInstance;
    fusabase._apps["[DEFAULT]"] = appInstance;

    return appInstance;
  },

  app(name: string = "[DEFAULT]"): App {
    const appInstance = this._apps[name];
    if (!appInstance) {
      const error = new Error(getErrorMessage('appNotInitialized')) as ErrorWithStatus;
      error.status = 404;
      throw appErrorHandler(error);
    }
    return appInstance;
  },

  storage(app?: App) {
    const app_ = app ?? this.app();
    if (app_ == null) {
      const error = new Error(getErrorMessage('appNotInitialized')) as ErrorWithStatus;
      error.status = 404;
      throw appErrorHandler(error);
    }
    return app_.storage();
  },

  auth(app?: App) {
    const app_ = app ?? this.app();
    if (app_ == null) {
      const error = new Error(getErrorMessage('appNotInitialized')) as ErrorWithStatus;
      error.status = 404;
      throw appErrorHandler(error);
    }
    return app_.auth();
  },

  oracledb(app?: App) {
    const app_ = app ?? this.app();
    if (app_ == null) {
      const error = new Error(getErrorMessage('appNotInitialized')) as ErrorWithStatus;
      error.status = 404;
      throw appErrorHandler(error);
    }
    return app_.oracledb();
  },

  setLogLevel(log: LogLevel): void {
    for (const instance of Object.values(this._apps) as App[]) {
        instance.logLevel = log;
    }
  },

  appErrorHandler,
};

export default fusabase;
