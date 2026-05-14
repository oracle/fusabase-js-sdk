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

/*
 * TaskState Changes:
 * PAUSED &#45;> RUNNING : ref.put() or uploadTask.resume()
 * PAUSED &#45;> CANCELED : uploadTask.cancel()
 * PAUSED &#45;> ERROR : Already went fetch() can return with ERROR
 * PAUSED &#45;> SUCCESS : Already went fetch() for final Chunk can return with SUCCESS
 * RUNNING &#45;> CANCELED : uploadTask.cancel()
 * RUNNING &#45;> ERROR : a fetch() can return ERROR
 * RUNNING &#45;> SUCCESS : final chunk returned SUCCESS
 * RUNNING &#45;> PAUSED : uploadTask.pause()
 * CANCELED &#45;> X : No Operation Allowed
 * SUCCESS &#45;> X : No Operation Allowed
 * ERROR &#45;> (handle different errors)
 * 
 * Possible Issue: check for CANCELED &#45;> SUCCESS in final commit, setCallbacks?;
 */
/**
 * Lifecycle states for an upload task.
 * @public
 */
export enum TaskState {
  CANCELED,
  ERROR,
  PAUSED,
  RUNNING,
  SUCCESS
}

/*
 * TaskEvent
 * Task event names.
 */
/**
 * Upload task event names.
 * @public
 */
export enum TaskEvent {
  STATE_CHANGED
}

/**
 * Maps TaskEvent values to their string event identifiers.
 * @public
 */
export const eventMap = {
  [TaskEvent.STATE_CHANGED]: "state_changed",
};

// New public types for Storage metadata and listing options

// UploadMetadata: Settable by callers when uploading objects
// Only contentType and md5Hash are supported, both as strings
/**
 * Settable metadata when uploading objects.
 * Only a limited subset of metadata is supported.
 * @public
 */
export type UploadMetadata = {
  /** MIME type of the object (e.g., "image/png"). */
  contentType?: string;
  /** Base64-encoded MD5 hash of the object contents. */
  md5Hash?: string;
};

// FullMetadata: Returned from getMetadata, upload results, and snapshots
// Required: bucket, fullPath, name, size, timeCreated, updated
// Optional: contentType, md5Hash, generation, metageneration
/**
 * Complete metadata returned by storage operations such as getMetadata,
 * upload results, and task snapshots.
 * @public
 */
export type FullMetadata = {
  /** Storage bucket identifier containing the object. */
  bucket: string;
  /** Full path to the object within the bucket. */
  fullPath: string;
  /** Object name (last path segment). */
  name: string;
  /** Object size in bytes. */
  size: number;
  /** ISO 8601 UTC timestamp when the object was created. */
  timeCreated: string;
  /** ISO 8601 UTC timestamp when the object was last updated. */
  updated: string;
  /** MIME type of the object (e.g., "image/png"). */
  contentType?: string;
  /** Base64-encoded MD5 hash of the object contents. */
  md5Hash?: string
};

// ListOptions: Options when listing objects
/**
 * Options to control listing of objects.
 * @public
 */
export type ListOptions = {
  /**
   * Maximum number of results to return per page.
   * If null or undefined, the backend default is used.
   */
  maxResults?: number | null;
  /**
   * Page token from a previous list operation to continue listing.
   * If null or undefined, listing starts from the beginning.
   */
  pageToken?: string | null;
};
