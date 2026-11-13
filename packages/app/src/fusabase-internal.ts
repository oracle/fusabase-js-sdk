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
import { App, BackendType, FusabaseConfig, FusabaseOptions } from "./public-types.js";
import {LogLevel} from "../../logger/LogLevel.js";
import { getOrCreateBrowserInstanceId } from './instance-id.js';
import { Component } from './component.js';

// Error type with HTTP-like status
interface ErrorWithStatus extends Error {
  status?: number;
}

export const _components = new Map<string, Component<any>>();

const RESERVED_APP_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

function validateAppName(name: unknown): asserts name is string {
  if (typeof name !== 'string' || name.trim().length === 0 || RESERVED_APP_NAMES.has(name)) {
    const error = new Error('Invalid app name') as ErrorWithStatus;
    error.status = 400;
    throw appErrorHandler(error);
  }
}

export function _registerComponent<T>(component: Component<T>): boolean {
  if (_components.has(component.name)) {
    return false;
  }
  _components.set(component.name, component);
  for (const app of Object.values(fusabase._apps)) {
    if (app instanceof App && !app.isDeleted) {
      app.container.addComponent(component);
    }
  }
  return true;
}

export function _getProvider<T>(app: App, name: string) {
  return app.container.getProvider<T>(name);
}

export function _removeServiceInstance(app: App, name: string, instanceIdentifier = '[DEFAULT]'): Promise<void> {
  return app.container.getProvider(name).clearInstance(instanceIdentifier);
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
  invalidBackendType: 'Invalid backend type',
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

function normalizeAppConfig(config: FusabaseConfig): Omit<FusabaseOptions, 'backendType'> {
  return {
    ordsHost: config.ords_host,
    schema: config.schema,
    appName: config.app_name,
    appType: config.app_type,
    appID: config.app_id,
    projectID: config.project_id,
    objsType: config.objs_type,
    storageBucket: config.storage_bucket,
    authType: config.auth_type,
    authID: config.auth_id,
    useSocket: config.use_socket,
    longPollingInterval: config.long_polling_interval,
    chunkSize: config.upload_chunk_size,
    maxUploadBytes: config.max_upload_bytes,
  };
}

// -------------------- SOBa Core Object --------------------
const fusabase = {

  _apps: Object.create(null) as Record<string, App>,

  get apps(): App[] {
    const appsArr: App[] = [];
    Object.entries(this._apps).forEach(([_, value]) => {
        if (!value.isDeleted) {
          appsArr.push(value as App);
        }
    });
    return appsArr;
    },


  initializeApp(
    options_sdk: FusabaseConfig,
    name: string = "[DEFAULT]",
    backendTypeOverride?: BackendType | null
  ): App {
    validateAppName(name);
    if (Object.hasOwn(fusabase._apps, name)) {
      const error = new Error(`App named "${name}" has already been initialized.`) as ErrorWithStatus;
      error.status = 409;
      throw appErrorHandler(error);
    }
    const config = normalizeAppConfig(options_sdk);
    const requestedBackendType = backendTypeOverride;
    const backendType = requestedBackendType == null
      ? "COLLECTION"
      : requestedBackendType;

    if (backendType !== "COLLECTION" && backendType !== "RELATIONAL") {
      const error = new Error(getErrorMessage('invalidBackendType')) as ErrorWithStatus;
      error.status = 400;
      throw appErrorHandler(error);
    }
    const normalizedBackendType = backendType === "RELATIONAL" ? "relational" : "collection";
    argCheck(config.ordsHost, getErrorMessage('invalidOrdsHost'), true, [typeStrings.STRING]);
    argCheck(config.schema, getErrorMessage('invalidSchema'), true, [typeStrings.STRING]);
    argCheck(config.appID, getErrorMessage('invalidAppId'), true, [typeStrings.STRING]);
    argCheck(config.projectID, getErrorMessage('invalidProjectId'), true, [typeStrings.STRING]);
    argCheck(config.objsType, getErrorMessage('invalidObjsType'), true, [typeStrings.STRING]);
    argCheck(config.storageBucket, getErrorMessage('invalidStorageBucket'), true, [typeStrings.STRING]);
    argCheck(config.authType, getErrorMessage('invalidAuthType'), true, [typeStrings.STRING]);
    argCheck(config.appType, "Invalid app type", true, [typeStrings.STRING]);

    argCheck(config.authID, getErrorMessage('invalidAuthId'), true, [typeStrings.STRING]);
    const authType = String(config.authType).toLowerCase();
    // e-idcs uses the same identity-domain implementation and endpoints as IDCS.
    const normalizedAuthType = authType === "e-idcs" ? "idcs" : authType;
    if (normalizedAuthType === "idcs") {
      argCheck(config.idcsDomainURL, "Invalid IDCS domain URL", false, [typeStrings.STRING]);
    }

    argCheck(config.useSocket, getErrorMessage('invalidSocketValue'), false, [typeStrings.BOOL]);
    argCheck(config.longPollingInterval, getErrorMessage('invalidPollingInterval'), false, [typeStrings.INT]);
    argCheck(config.chunkSize, getErrorMessage('invalidChunkSize'), false, [typeStrings.INT]);
    argCheck(config.maxUploadBytes, getErrorMessage('invalidMaxUploadBytes'), false, [typeStrings.INT]);

    const options: FusabaseOptions = {
      backendType: normalizedBackendType,
      ordsHost: config.ordsHost,
      schema: config.schema,
      appName: config.appName,
      appType: String(config.appType).toLowerCase(),
      appID: config.appID,
      projectID: config.projectID,
      objsType: String(config.objsType).toLowerCase(),
      storageBucket: config.storageBucket,
      authType: normalizedAuthType,
      authID: config.authID,
      idcsDomainURL: config.idcsDomainURL,
      useSocket: config.useSocket !== false,
      longPollingInterval: config.longPollingInterval
        ? config.longPollingInterval
        : 29,
      version: 2,
      chunkSize: config.chunkSize ? config.chunkSize : 16 * 1024 * 1024,
      maxUploadBytes: config.maxUploadBytes,
    };

    const appInstance = new App(options, name);
    for (const component of _components.values()) {
      appInstance.container.addComponent(component);
    }

    try {
      (appInstance as any)._instanceId = getOrCreateBrowserInstanceId();
    } catch {
      // ignore
    }

    appInstance._intializeAfterConfig();
    fusabase._apps[name] = appInstance;

    return appInstance;
  },

  app(name: string = "[DEFAULT]"): App {
    validateAppName(name);
    if (!Object.hasOwn(this._apps, name)) {
      const error = new Error(getErrorMessage('appNotInitialized')) as ErrorWithStatus;
      error.status = 404;
      throw appErrorHandler(error);
    }
    const appInstance = this._apps[name];
    if (appInstance.isDeleted) {
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

  relational(app?: App) {
    const app_ = app ?? this.app();
    if (app_ == null) {
      const error = new Error(getErrorMessage('appNotInitialized')) as ErrorWithStatus;
      error.status = 404;
      throw appErrorHandler(error);
    }
    return app_.relational();
  },

  setLogLevel(log: LogLevel): void {
    for (const instance of Object.values(this._apps) as App[]) {
      if (!instance.isDeleted) {
        instance.logLevel = log;
      }
    }
  },

  appErrorHandler,
};

export default fusabase;
