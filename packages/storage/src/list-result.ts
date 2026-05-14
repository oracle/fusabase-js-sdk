import { StorageError, storageErrorHandler, StorageErrorCode, getStorageErrorMessage } from "./errors.js";
import { StorageReference } from "./internal/reference.js";
import { ListResult } from "./internal/result.js";
import type { ListOptions } from "./types.js";

/**
 * Lists the files and directories at the given reference.
 * @param ref - The StorageReference to list items from.
 * @param options - Options for the list operation, such as maxResults and pageToken.
 * @returns {Promise<ListResult>} A promise that resolves with the list result.
 */
export async function list(ref: StorageReference, options?: ListOptions): Promise<ListResult> {
  if (!(ref instanceof StorageReference)) {
    let error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_REFERENCE'));
    error.status = 400;
    throw storageErrorHandler(error);
  }
  return ref.list(options);
}

/**
 * Lists all files and directories recursively at the given reference.
 * @param ref - The StorageReference to list all items from.
 * @returns {Promise<ListResult>} A promise that resolves with the list result.
 */
export async function listAll(ref: StorageReference): Promise<ListResult> {
  if (!(ref instanceof StorageReference)) {
    let error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_REFERENCE'));
    error.status = 400;
    throw storageErrorHandler(error);
  }
  return ref.listAll();
}
