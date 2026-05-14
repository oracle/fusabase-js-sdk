import { App } from "../../app/src/public-types.js";
import fusabase from "../../app/src/fusabase-internal.js";
import { StorageError, storageErrorHandler, StorageErrorCode, getStorageErrorMessage } from "./errors.js";
import { Storage } from "./internal/storage.js";

/**
 * Gets a Storage instance for the given app and URL.
 * @param app - The FUSABASE app instance.
 * @param url - The storage URL.
 * @returns A Storage instance.
 */
export function getStorage(app?: App | null, url?: string): Storage {
  app = app == null ? fusabase.app() : app;
  if (!(app instanceof App)) {
    let error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_APP'));
    error.status = 400;
    throw storageErrorHandler(error);
  }
  return fusabase.storage(app) as any;
}
