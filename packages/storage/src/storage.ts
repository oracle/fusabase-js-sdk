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
