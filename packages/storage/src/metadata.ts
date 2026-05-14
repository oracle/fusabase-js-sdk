import { StorageError, storageErrorHandler, StorageErrorCode, getStorageErrorMessage } from "./errors.js";
import { StorageReference } from "./internal/reference.js";
import type { FullMetadata } from "./types.js";

/**
 * Gets the download URL for the given reference.
 * @param ref - The StorageReference to get the download URL for.
 * @returns A promise that resolves with the download URL.
 */
export async function getDownloadURL(ref: StorageReference): Promise<string> {
  if (!(ref instanceof StorageReference)) {
    let error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_REFERENCE'));
    error.status = 400;
    throw storageErrorHandler(error);
  }
  return ref.getDownloadURL();
}

/**
 * Gets the metadata for the given reference.
 * @param ref - The StorageReference to get metadata for.
 * @returns A promise that resolves with the metadata object.
 */
export async function getMetadata(ref: StorageReference): Promise<FullMetadata> {
    if (!(ref instanceof StorageReference)) {
        let error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_REFERENCE'));
        error.status = 400;
        throw storageErrorHandler(error);
    }
    return ref.getMetadata();
}
