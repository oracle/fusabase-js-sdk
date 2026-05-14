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

import { App } from "./public-types.js";
import { FusabaseError } from "./errors.js";
import { LogLevel } from "../../logger/LogLevel.js";
import {initializeApp, getApp, getApps, deleteApp, setLogLevel} from './app.js';
import { fusabaseFetch } from './fusabase-fetch.js';

/**
 * Initializes the FUSABASE app with the provided configuration options.
 * @param options - The configuration options for the app, or null.
 * @param name - Optional name for the app. Defaults to "[DEFAULT]" if not provided.
 * @returns The initialized App instance.
 */
export {initializeApp};

/**
 * Retrieves an existing App instance by its name.
 * @param name - The name of the app to retrieve. Defaults to "[DEFAULT]" if not provided.
 * @returns The App instance with the specified name.
 */
export {getApp};

/**
 * Retrieves all initialized App instances.
 * @returns An array of all App instances.
 */
export {getApps};

/**
 * Deletes the specified App instance and cleans up its resources.
 * @param app - The App instance to delete.
 * @returns A promise that resolves to null when deletion is complete.
 */
export {deleteApp};

/**
 * Sets the log level for all initialized apps.
 * @param logLevel - The LogLevel to apply to all apps.
 */
export {setLogLevel};

/**
 * The main App class that holds initialization information for a collection of FUSABASE services.
 */
export { App };

/**
 * Custom error class for FUSABASE operations, extending the standard Error class.
 */
export { FusabaseError };

/**
 * Enumeration of available log levels for FUSABASE applications.
 */
export {LogLevel};

/**
 * Low-level fetch wrapper used internally by SDK modules.
 * Attaches FUSABASE headers (App Check + Instance Id) on eligible baas-services URLs
 * and retries once on 403 App Check failures.
 */
export { fusabaseFetch };
