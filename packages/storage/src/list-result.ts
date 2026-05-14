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
