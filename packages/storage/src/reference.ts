import { StorageError, storageErrorHandler, StorageErrorCode, getStorageErrorMessage } from "./errors.js";
import { Storage } from "./internal/storage.js";
import { StorageReference } from "./internal/reference.js";

function throwInvalidDownloadSize(): never {
  const error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_DOWNLOAD_SIZE'));
  error.status = 400;
  throw storageErrorHandler(error);
}

function throwDownloadLimitExceeded(maxBytes: number): never {
  const error = new StorageError(
    StorageErrorCode.INVALID_ARGUMENT,
    getStorageErrorMessage('DOWNLOAD_EXCEEDS_LIMIT', String(maxBytes))
  );
  error.status = 400;
  throw storageErrorHandler(error);
}

async function assertMetadataWithinDownloadLimit(
  ref: StorageReference,
  maxDownloadSizeBytes: number | null
): Promise<void> {
  if (maxDownloadSizeBytes == null) return;

  if (!Number.isSafeInteger(maxDownloadSizeBytes) || maxDownloadSizeBytes <= 0) {
    throwInvalidDownloadSize();
  }

  const metadata = await ref.getMetadata();
  if (metadata.size > maxDownloadSizeBytes) {
    throwDownloadLimitExceeded(maxDownloadSizeBytes);
  }
}

/**
 * Creates a StorageReference from a storage instance and path.
 * @param storage - The Storage instance or StorageReference.
 * @param path - The path to the storage object.
 * @returns A StorageReference.
 */
export function ref(storage: Storage | StorageReference, path: string): StorageReference {
  if (!(storage instanceof Storage || storage instanceof StorageReference)) {
    let error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_STORAGE'));
    error.status = 400;
    throw storageErrorHandler(error);
  }
  if (path != null && (path.startsWith('http://') || path.startsWith('https://'))) {
    if (storage instanceof StorageReference) {
      let err = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_URL_REFERENCE'));
      err.status = 400;
      throw storageErrorHandler(err);
    }
    return (storage as Storage).refFromURL(path);
  }
  if (storage instanceof StorageReference) {
    return storage.child(path);
  }
  return (storage as Storage).ref(path);
}

/**
 * Downloads the data as an ArrayBuffer from the given reference.
 * @param ref - The StorageReference to download data from.
 * @param maxDownloadSizeBytes - The maximum size of data to download in bytes, or null for no limit.
 * @returns A promise that resolves with the ArrayBuffer.
 */
export async function getBytes(ref: StorageReference, maxDownloadSizeBytes: number | null): Promise<ArrayBuffer> {
  if (!(ref instanceof StorageReference)) {
    let error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_REFERENCE'));
    error.status = 400;
    throw storageErrorHandler(error);
  }
  await assertMetadataWithinDownloadLimit(ref, maxDownloadSizeBytes);
  const res = await ref.downloadData(maxDownloadSizeBytes);
  if (res) {
    return res.arrayBuffer();
  } else {
    throw new StorageError(StorageErrorCode.UNKNOWN, getStorageErrorMessage('UNKNOWN'));
  }
}

/**
 * Downloads the data as a Blob from the given reference.
 * @param ref - The StorageReference to download data from.
 * @param maxDownloadSizeBytes - The maximum size of data to download in bytes, or null for no limit.
 * @returns A promise that resolves with the Blob.
 */
export async function getBlob(ref: StorageReference, maxDownloadSizeBytes: number | null): Promise<Blob> {
  if (!(ref instanceof StorageReference)) {
    let error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_REFERENCE'));
    error.status = 400;
    throw storageErrorHandler(error);
  }
  await assertMetadataWithinDownloadLimit(ref, maxDownloadSizeBytes);
  const res = await ref.downloadData(maxDownloadSizeBytes);
  if (res) {
    return res.blob();
  } else {
    throw new StorageError(StorageErrorCode.UNKNOWN, getStorageErrorMessage('UNKNOWN'));
  }
}

/**
 * Downloads the data as a stream from the given reference.
 * @param ref - The StorageReference to download data from.
 * @param maxDownloadSizeBytes - The maximum size of data to download in bytes, or null for no limit.
 * @returns A promise that resolves with the response stream.
 */
export async function getStream(ref: StorageReference, maxDownloadSizeBytes: number | null): Promise<any> {
  if (!(ref instanceof StorageReference)) {
    let error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_REFERENCE'));
    error.status = 400;
    throw storageErrorHandler(error);
  }
  await assertMetadataWithinDownloadLimit(ref, maxDownloadSizeBytes);
  return ref.downloadData(maxDownloadSizeBytes);
}

/**
 * Deletes the object at the given reference.
 * @param ref - The StorageReference to delete the object at.
 * @returns A promise that resolves when the object is deleted.
 */
export async function deleteObject(ref: StorageReference): Promise<void> {
  if (!(ref instanceof StorageReference)) {
    let error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_REFERENCE'));
    error.status = 400;
    throw storageErrorHandler(error);
  }
  return ref.delete();
}

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
