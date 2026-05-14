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
