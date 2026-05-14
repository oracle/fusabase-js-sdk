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

import { StorageError } from "./errors.js";
import { list, listAll } from "./list-result.js";
import { getMetadata } from "./metadata.js";
import { deleteObject, getBlob, getBytes, getDownloadURL, getStream, ref } from "./reference.js";
import { getStorage } from "./storage.js";
import { TaskEvent, TaskState } from "./types.js";
import { uploadBytes, uploadBytesResumable } from "./upload-task.js";
import { Storage } from "./internal/storage.js";
import { StorageReference } from "./internal/reference.js";
import { ListResult } from "./internal/result.js";
import { UploadTask, UploadTaskSnapshot } from "./internal/uploadTask.js";
import type { UploadMetadata, FullMetadata, ListOptions } from "./types.js";

export {
  getStorage,
  ref,
  list,
  listAll,
  getDownloadURL,
  getMetadata,
  uploadBytes,
  uploadBytesResumable,
  getBytes,
  getBlob,
  getStream,
  deleteObject,
  TaskEvent,
  TaskState,
  StorageError,
  Storage,
  StorageReference,
  ListResult,
  UploadTask, 
  UploadTaskSnapshot,
  UploadMetadata, FullMetadata, ListOptions
};
