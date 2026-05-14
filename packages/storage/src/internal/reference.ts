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

import { argCheck, StorageError, storageErrorHandler, typeStrings, StorageErrorCode, getStorageErrorMessage } from "../errors.js";

import { ListResult } from "./result.js";
import { UploadTask } from "./uploadTask.js";
import { getAccessToken, isValidMetadata } from "./utils.js";
import type { ListOptions, UploadMetadata, FullMetadata } from "../types.js";

/**
 * Class representing a reference to a storage location.
 */
export class StorageReference {
  /** The name of the storage object. */
  name: string;
  /** The root reference. */
  root: StorageReference | null;
  /** The parent reference. */
  parent: StorageReference | null;
  /** The storage instance. */
  storage: any;

  /** @internal */
  constructor(storage: any, path: string, parent: StorageReference | null = null) {
    argCheck(storage, 'Invalid storage object', true, [typeStrings.OBJECT]);
    path = path ? path : "";
    // Check for invalid path
    path = path.toString().trim();
    if (path.endsWith('/')) {
      let error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_CHILD_PATH'));
      error.status = 400;
      throw storageErrorHandler(error);
    }

    let tokens = path.split("/");
    this.name = tokens.pop() as string;
    if (tokens.length === 0 && this.name === "") this.parent = parent;
    else this.parent = new StorageReference(storage, tokens.join("/"), parent);

    this.root = this.parent == null ? this : this.parent.root;
    this.storage = storage;
  }

  /**
   * Gets the bucket name.
   * @returns The bucket name.
   */
  get bucket(): string {
    return this.storage.bucket;
  }

  /**
   * Gets the full path for the reference.
   * @returns The full path string.
   */
  get fullPath(): string {
  if (this.name === "")
    return "";
  if (this.parent) {
    return this.parent.fullPath === "" ? `${this.name}` : `${this.parent.fullPath}/${this.name}`;
  } else {
    return this.name;
  }
}

  /**
   * Gets a child reference.
   * @param path - The relative path to the child.
   * @returns The child StorageReference.
   */
  /**
   * @internal
   */
  child(path: string): StorageReference {
    argCheck(path, "Invalid child path", true, [typeStrings.STRING]);
    if (path === "") return this;
    return new StorageReference(this.storage, `${this.fullPath}/${path}`, this);
  }

  /**
   * Deletes the object at this reference.
   * @returns A promise that resolves when the object is deleted.
   */
  /**
   * @internal
   */
  async delete(): Promise<void> {
    const access_token = await getAccessToken(this.storage.app);
    return this.storage.__deleteObject(this.fullPath, access_token);
  }

  /**
   * Lists the files and directories at this reference.
   * @param options - Options for listing, such as maxResults and pageToken.
   * @returns A promise that resolves with the list result.
   */
  /**
   * @internal
   */
  async list(options?: ListOptions): Promise<ListResult> {
    argCheck(options, "Invalid options object", false, [typeStrings.OBJECT]);
    const access_token = await getAccessToken(this.storage.app);

    let result = null;
    const listOptions = {
      maxResults: options?.maxResults ?? null,
      pageToken: options?.pageToken ?? null
    }

    try {
      const data = await this.storage.__getLists(false, this.fullPath, listOptions, access_token);
      for (let i =0;i<data["items"].length;i++) {
        data["items"][i] = this.storage.ref(data["items"][i]); 
      }
      for (let i =0;i<data["prefixes"].length;i++) {
        data["prefixes"][i] = this.storage.ref(data["prefixes"][i]); 
      }
      result = new ListResult(data);
    }
    catch (err) {
      throw storageErrorHandler(err);
    }

    return result as ListResult;
  }

  /**
   * Lists all files and directories recursively at this reference.
   * @returns A promise that resolves with the list result.
   */
  /**
   * @internal
   */
  async listAll(): Promise<ListResult> {
    const access_token = await getAccessToken(this.storage.app);

    let result = null;

    const listOptions = {
      maxResults: null,
      pageToken: null
    }

    try {
      const data = await this.storage.__getLists(true, this.fullPath, listOptions, access_token);
      for (let i =0;i<data["items"].length;i++) {
        data["items"][i] = this.storage.ref(data["items"][i]); 
      }
      for (let i =0;i<data["prefixes"].length;i++) {
        data["prefixes"][i] = this.storage.ref(data["prefixes"][i]); 
      }
      result = new ListResult(data);
    }
    catch (err) {
      throw storageErrorHandler(err);
    }

    return result as ListResult;
  }

  /**
   * Uploads data to this reference and returns an UploadTask.
   * @param data - The data to upload.
   * @param metadata - Optional metadata for the upload.
   * @returns The UploadTask for managing the upload.
   */
  /**
   * @internal
   */
  put(data: Blob | ArrayBuffer | Uint8Array, metadata: UploadMetadata = { contentType: "application/octet-stream" }): UploadTask {
  argCheck(data, "Invalid upload data", true, [typeStrings.OBJECT]);
  argCheck(metadata, "Invalid metadata object", false, [typeStrings.OBJECT]);

    if (!isValidMetadata(metadata)) {
      let err = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_METADATA'));
      err.status = 400;
      throw storageErrorHandler(err);
    }

    const res = new UploadTask(data, metadata, this);
    return res;
  }

  /**
   * Downloads the data from this reference.
   * @param maxSize - The maximum size to download, or null for no limit.
   * @returns A promise that resolves with the response or null.
   */
  /**
   * @internal
   */
  async downloadData(maxSize: number | null): Promise<Response | null> {
    const access_token = await getAccessToken(this.storage.app);
    return this.storage.__downloadData(`${this.fullPath}`, maxSize, access_token);
  }

  /**
   * Gets the download URL for this reference.
   * @returns A promise that resolves with the download URL.
   */
  /**
   * @internal
   */
  async getDownloadURL(): Promise<string> {
    const access_token = await getAccessToken(this.storage.app);

    let result = null;

    try {
      result = await this.storage.__fetchDownloadUrl(`${this.fullPath}`, access_token);
    }
    catch (err) {
      throw storageErrorHandler(err);
    }

    return result.URL;
  }

  /**
   * Gets the metadata for this reference.
   * @returns A promise that resolves with the metadata object.
   */
  /**
   * @internal
   */
  async getMetadata(): Promise<FullMetadata> {
    const access_token = await getAccessToken(this.storage.app);

    let result = null;
    try {
      result = await this.storage.__fetchMetadata(this, access_token);
    }
    catch (err) {
      throw storageErrorHandler(err);
    }
    return result;
  }
}
