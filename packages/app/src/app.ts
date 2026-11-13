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

import fusabase from "./fusabase-internal.js";
import { App } from "./public-types.js";
import {LogLevel} from "../../logger/LogLevel.js";
import { BackendType, FusabaseConfig } from "./public-types.js";

/**
 * Initializes an application with the supplied configuration.
 *
 * @param {FusabaseConfig} options - Console configuration. Required fields are
 * `ords_host`, `schema`, `app_type`, `app_id`, `project_id`, `objs_type`,
 * `storage_bucket`, `auth_type`, `auth_id`, and `backend_type`. Optional fields
 * are `app_name`, `use_socket`, `long_polling_interval`, `upload_chunk_size`,
 * and `max_upload_bytes`.
 * @param {string} [name] - Unique local app name. Defaults to `"[DEFAULT]"`.
 * @param {BackendType | null} [backendType] - Optional backend family. Use
 * `COLLECTION` or `RELATIONAL`; when omitted, the collection backend is used.
 * @returns {App} The initialized application instance.
 * @throws {FusabaseError} If the configuration is missing or invalid.
 * @example
 * ```ts
 * const app = initializeApp({
 *   ords_host: "https://example.com/ords/USER1/",
 *   schema: "user1",
 *   app_name: "TodoApp",
 *   app_type: "WEB",
 *   app_id: "app-id",
 *   project_id: "project-id",
 *   objs_type: "dbfs",
 *   storage_bucket: "bucket-name",
 *   auth_type: "base",
 *   auth_id: "auth-id",
 *   backend_type: "COLLECTION",
 * });
 * ```
 *
 * @example Initialize a named relational app.
 * ```ts
 * const app = initializeApp(config, "reporting", "RELATIONAL");
 * ```
 *
 * @example Initialize a named collection app.
 * ```ts
 * const app = initializeApp(config, "primary", "COLLECTION");
 * ```
 */
export function initializeApp(
  options: FusabaseConfig | null,
  name?: string,
  backendType?: BackendType | null
): App {
  if (options == null) {
    const err = new Error("Incorrect config provided!") as Error & { status?: number };
    err.status = 400;
    throw fusabase.appErrorHandler(err);
  }

  const configuredBackend = options.backend_type;
  if (configuredBackend != null && configuredBackend !== "COLLECTION" && configuredBackend !== "RELATIONAL") {
    const err = new Error("backend_type must be COLLECTION or RELATIONAL") as Error & { status?: number };
    err.status = 400;
    throw fusabase.appErrorHandler(err);
  }
  if (configuredBackend === "RELATIONAL" && backendType !== "RELATIONAL") {
    const err = new Error("RELATIONAL configuration must be initialized through the relational client API") as Error & { status?: number };
    err.status = 400;
    throw fusabase.appErrorHandler(err);
  }
  if (configuredBackend === "COLLECTION" && backendType === "RELATIONAL") {
    const err = new Error("COLLECTION configuration cannot be initialized through the relational client API") as Error & { status?: number };
    err.status = 400;
    throw fusabase.appErrorHandler(err);
  }

  if (name == null) {
    name = "[DEFAULT]";
  }

  return fusabase.initializeApp(options, name, backendType);
}

/**
 * Gets an initialized application by name.
 *
 * @param name - Optional application name.
 * @returns The matching application instance.
 * @throws {FusabaseError} If no application with the requested name exists.
 * @example
 * ```ts
 * const app = getApp();
 * ```
 *
 * @example Get a named app.
 * ```ts
 * const reportingApp = getApp("reporting");
 * ```
 */
export function getApp(name?: string): App {
  if (name == null) {
    name = "[DEFAULT]";
  }
  return fusabase.app(name);
}

/**
 * Gets all active application instances.
 *
 * @returns The active application instances.
 * @example
 * ```ts
 * const apps = getApps();
 * ```
 */
export function getApps(): App[] {
  const apps: App[] = [];
  Object.entries(fusabase._apps).forEach(([_, value]) => {
    if (value instanceof App && !value.isDeleted) {
      apps.push(value);
    }
  });
  return apps;
}

/**
 * Deletes an application and releases its registered services.
 *
 * @param app - Application instance to delete.
 * @returns A promise that resolves to `null` after deletion.
 * @throws {FusabaseError} If `app` is not a valid application instance or deletion fails.
 * @example
 * ```ts
 * await deleteApp(app);
 * ```
 */
export async function deleteApp(app: App): Promise<null> {
  if (!(app instanceof App)) {
    const err = new Error("App instance is null!") as Error & { status?: number };
    err.status = 400;
    throw fusabase.appErrorHandler(err);
  }
  await app.delete();
  for (const [name, registeredApp] of Object.entries(fusabase._apps)) {
    if (name !== "[DEFAULT]" && registeredApp === app) {
      delete fusabase._apps[name];
    }
  }
  return null;
}

/**
 * Sets the log level for every active application.
 *
 * @param logLevel - Log level to apply.
 * @returns Nothing.
 * @example
 * ```ts
 * setLogLevel(LogLevel.DEBUG);
 * ```
 */
export function setLogLevel(logLevel: LogLevel): void {
  const apps = getApps();
  for (let i = 0; i < apps.length; i++) {
    apps[i].logLevel = logLevel;
  }
}
