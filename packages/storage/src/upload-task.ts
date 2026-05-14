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
