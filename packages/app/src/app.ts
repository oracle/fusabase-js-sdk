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
import { FusabaseOptions } from "./public-types.js"; // your existing options interface

/**
 * Initializes and registers an application instance.
 *
 * @param options - The application configuration.
 * @param name - An optional instance name; defaults to the primary instance.
 * @returns The initialized application instance.
 * @example
 * ```ts
 * const app = initializeApp({ projectId: 'my-project', appId: 'my-app' });
 * ```
 */
export function initializeApp(options: FusabaseOptions | null, name?: string): App {
  if (options == null) {
    const err = new Error("Incorrect config provided!") as Error & { status?: number };
    err.status = 400;
    throw fusabase.appErrorHandler(err);
  }

  if (name == null) {
    name = "[DEFAULT]";
  } else if (typeof name === "object") {
    // If name was mistakenly passed as an object, assume it has a .name
    name = (name as { name?: string }).name ?? "[DEFAULT]";
  }

  return fusabase.initializeApp(options, name);
}

/**
 * Returns a previously initialized application instance.
 *
 * @param name - The optional instance name; defaults to the primary instance.
 * @returns The matching application instance.
 * @example
 * ```ts
 * const app = getApp();
 * ```
 */
export function getApp(name?: string): App {
  if (name == null) {
    name = "[DEFAULT]";
  }
  return fusabase.app(name);
}

/**
 * Returns all initialized application instances.
 *
 * @returns An array of application instances.
 * @example
 * ```ts
 * console.log(getApps().map(app => app.name));
 * ```
 */
export function getApps(): App[] {
  const apps: App[] = [];
  Object.entries(fusabase._apps).forEach(([_, value]) => {
    if (value instanceof App) {
      apps.push(value);
    }
  });
  return apps;
}

/**
 * Deletes an application instance and releases its registered services.
 *
 * @param app - The application instance to delete.
 * @returns A promise resolving to `null` after deletion.
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
  return null;
}

/**
 * Sets the log level for every initialized application.
 *
 * @param logLevel - The level to apply.
 * @returns Nothing.
 * @example
 * ```ts
 * setLogLevel(LogLevel.WARN);
 * ```
 */
export function setLogLevel(logLevel: LogLevel): void {
  const apps = getApps();
  for (let i = 0; i < apps.length; i++) {
    apps[i].logLevel = logLevel;
  }
}
