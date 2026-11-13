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
 * @throws {StorageError} If the storage input is invalid or a URL is used with a child reference.
 * @example
 * ```ts
 * const fileRef = ref(storage, "images/logo.png");
 * ```
 *
 * @example Create a child reference from another reference.
 * ```ts
 * const thumbnailRef = ref(fileRef, "thumbnail.png");
 * ```
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
 * @throws {StorageError} If the reference or size limit is invalid, the object exceeds the limit, or download fails.
 * @example
 * ```ts
 * const bytes = await getBytes(fileRef, 5_000_000);
 * ```
 *
 * @example Download without a size limit.
 * ```ts
 * const bytes = await getBytes(fileRef, null);
 * ```
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
 * @throws {StorageError} If the reference or size limit is invalid, the object exceeds the limit, or download fails.
 * @example
 * ```ts
 * const blob = await getBlob(fileRef, 5_000_000);
 * ```
 *
 * @example Download without a size limit.
 * ```ts
 * const blob = await getBlob(fileRef, null);
 * ```
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
 * @throws {StorageError} If the reference or size limit is invalid, the object exceeds the limit, or download fails.
 * @example
 * ```ts
 * const stream = await getStream(fileRef, 5_000_000);
 * ```
 *
 * @example Download without a size limit.
 * ```ts
 * const stream = await getStream(fileRef, null);
 * ```
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
 * @throws {StorageError} If the reference is invalid or deletion fails.
 * @example
 * ```ts
 * await deleteObject(fileRef);
 * ```
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
 * @param timeExpires - Optional expiry time as a Date or date-time string. It
 * is sent to the service as an RFC3339 `timeExpires` value.
 * @returns A promise that resolves with the download URL.
 * @throws {StorageError} If the reference or expiration value is invalid, or URL retrieval fails.
 * @example
 * ```ts
 * const url = await getDownloadURL(fileRef);
 * ```
 *
 * @example Date expiry
 * ```ts
 * const url = await getDownloadURL(fileRef, new Date("2027-01-01T00:00:00Z"));
 * ```
 *
 * @example Pass an expiry as an RFC3339 string.
 * ```ts
 * const url = await getDownloadURL(fileRef, "2027-01-01T00:00:00Z");
 * ```
 */
export async function getDownloadURL(
  ref: StorageReference,
  timeExpires?: Date | string
): Promise<string> {
  if (!(ref instanceof StorageReference)) {
    let error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_REFERENCE'));
    error.status = 400;
    throw storageErrorHandler(error);
  }
  return ref.getDownloadURL(timeExpires);
}
