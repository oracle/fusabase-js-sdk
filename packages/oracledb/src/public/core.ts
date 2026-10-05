// Copyright (c) 2015, 2025, Oracle and/or its affiliates.

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

import { App } from "../../../app/src/public-types.js";
import fusabase from "../../../app/src/fusabase-internal.js";
import { _getProvider } from "../../../app/src/index.js";
import { Oracledb } from "../internal/core.js";
import { type OracledbSettings } from "../internal/settings.js";

/**
 * Initializes a database service instance for an application.
 *
 * @param app - The initialized application instance.
 * @param settings - Optional settings applied before the instance is used.
 * @param databaseId - Optional identifier for a named database.
 * @returns The initialized database service instance.
 * @example
 * ```ts
 * const db = initializeOracledb(app);
 * ```
 */
export function initializeOracledb(
  app: App,
  settings?: OracledbSettings,
  databaseId?: string
): Oracledb {
  if (!(app instanceof App)) {
    const error = new Error('Invalid app instance') as Error & { status?: number };
    error.status = 400;
    throw error;
  }
  const oracledb = _getProvider<Oracledb>(app, 'oracledb').getImmediate({
    identifier: databaseId
  }) as Oracledb;
  if (settings) {
    oracledb?.settings(settings);
  }
  return oracledb as any;
}

/**
 * Gets a database service instance for an application.
 *
 * @param app - The application instance; the primary instance is used when omitted.
 * @param databaseId - Optional identifier for a named database.
 * @returns The database service instance.
 * @example
 * ```ts
 * const db = getOracledb(app, 'primary');
 * ```
 */
export function getOracledb(app: App, databaseId: string): Oracledb;
export function getOracledb(app?: App): Oracledb;
export function getOracledb(app?: App,  databaseId?: string): Oracledb {
  app = app == null ? fusabase.app() : app;
  if (!(app instanceof App)) {
    const error = new Error('Invalid app instance') as Error & { status?: number };
    error.status = 400;
    throw error; // Use oracledbErrorHandler or similar if required
  }
  return _getProvider<Oracledb>(app, 'oracledb').getImmediate({
    identifier: databaseId
  }) as Oracledb;
}
