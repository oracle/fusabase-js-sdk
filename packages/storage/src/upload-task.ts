
import { StorageError, storageErrorHandler, StorageErrorCode, getStorageErrorMessage } from "./errors.js";
import { StorageReference } from "./internal/reference.js";
import type { UploadMetadata, FullMetadata } from "./types.js";

/**
 * Uploads data to the given reference.
 * @param ref - The StorageReference to upload data to.
 * @param data - The data to upload (Blob, ArrayBuffer, or Uint8Array).
 * @param metadata - Optional metadata for the upload.
 * @returns A promise that resolves with the upload result containing ref and metadata.
 */
export async function uploadBytes(
  ref: StorageReference,
  data: Blob | ArrayBuffer | Uint8Array,
  metadata?: UploadMetadata
): Promise<{ ref: StorageReference; metadata: FullMetadata }> {
    if (!(ref instanceof StorageReference)) {
        let error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_REFERENCE'));
        error.status = 400;
        throw storageErrorHandler(error);
    }
    const task = ref.put(data, metadata);
    const snapshot = await (task as unknown as Promise<{ metadata: FullMetadata }>);
    return { ref, metadata: snapshot.metadata };
}

/**
 * Uploads data to the given reference with resumable capability.
 * @param ref - The StorageReference to upload data to.
 * @param data - The data to upload (Blob, ArrayBuffer, or Uint8Array).
 * @param metadata - Optional metadata for the upload.
 * @returns A promise that resolves with the UploadTask.
 */
export function uploadBytesResumable(
  ref: StorageReference,
  data: Blob | ArrayBuffer | Uint8Array,
  metadata?: UploadMetadata
) {
    if (!(ref instanceof StorageReference)) {
        let error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_REFERENCE'));
        error.status = 400;
        throw storageErrorHandler(error);
    }
    return ref.put(data, metadata);
}
