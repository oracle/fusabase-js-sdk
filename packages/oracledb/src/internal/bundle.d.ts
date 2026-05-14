// Copyright (c) 2015, 2025, Oracle and/or its affiliates.

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

// import IndexDBStore from "./indexdb_storage.js";

// /**
//  * Represents a task that is loading a Oracledb bundle.
//  * 
//  * This class implements the `PromiseLike` interface, so it can be awaited.
//  * 
//  * You can use this to monitor progress or to catch errors during bundle loading.
//  *
//  * @example
//  * ```ts
//  * const task = loadBundle(oracledb, bundleData);
//  * 
//  * task.onProgress(
//  *   progress => console.log(progress.documentsLoaded, "/", progress.totalDocuments),
//  *   error => console.error("Bundle load failed:", error),
//  *   () => console.log("Bundle loading complete!")
//  * );
//  * 
//  * await task; // Waits for completion
//  * ```
//  */
// export declare class LoadBundleTask implements PromiseLike<LoadBundleTaskProgress> {
//   /**
//    * Implements the Promise `.then()` interface.
//    *
//    * Called when the task is completed successfully or fails with an error.
//    *
//    * @param onFulfilled - Called on completion with the final `LoadBundleTaskProgress` (state = `"Success"`).
//    * @param onRejected - Called if the task fails with an error.
//    * @returns A Promise resolving to either the fulfilled or rejected result.
//    *
//    * @example
//    * ```ts
//    * task.then(
//    *   result => console.log("Bundle loaded:", result),
//    *   error => console.error("Error loading bundle:", error)
//    * );
//    * ```
//    */
//   then<T, R>(
//     onFulfilled?: (a: LoadBundleTaskProgress) => T | PromiseLike<T>,
//     onRejected?: (a: Error) => R | PromiseLike<R>
//   ): Promise<T | R>;

//   /**
//    * Implements the Promise `.catch()` interface.
//    *
//    * Called when an error occurs during bundle loading.
//    *
//    * @param onRejected - Function called when an error occurs.
//    * @returns A Promise resolving to the return value of `onRejected` or a `LoadBundleTaskProgress`.
//    *
//    * @example
//    * ```ts
//    * task.catch(error => {
//    *   console.error("Failed to load bundle:", error);
//    * });
//    * ```
//    */
//   catch<R>(
//     onRejected: (a: Error) => R | PromiseLike<R>
//   ): Promise<R | LoadBundleTaskProgress>;

//   /**
//    * Registers functions to listen for bundle loading progress events.
//    *
//    * @param next - Called whenever there is a new progress update.
//    * @param error - Called if an error occurs during loading.
//    * @param complete - Called when loading completes successfully.
//    * @returns void
//    *
//    * @example
//    * ```ts
//    * task.onProgress(
//    *   progress => console.log(progress.documentsLoaded, "/", progress.totalDocuments),
//    *   error => console.error("Error:", error),
//    *   () => console.log("Bundle complete!")
//    * );
//    * ```
//    */
//   onProgress(
//     next?: (progress: LoadBundleTaskProgress) => unknown,
//     error?: (err: Error) => unknown,
//     complete?: () => void
//   ): void;
// }

// /**
//  * Represents the progress of loading a Oracledb bundle.
//  * 
//  * A `LoadBundleTaskProgress` object provides information about how much
//  * of a Oracledb bundle has been loaded and the current task state.
//  *
//  * @example
//  * ```ts
//  * const progress: LoadBundleTaskProgress = {
//  *   bytesLoaded: 1024,
//  *   documentsLoaded: 10,
//  *   totalBytes: 4096,
//  *   totalDocuments: 50,
//  *   taskState: "Running"
//  * };
//  * 
//  * console.log(`Loaded ${progress.documentsLoaded}/${progress.totalDocuments} documents`);
//  * ```
//  */
// export declare interface LoadBundleTaskProgress {
//   /**
//    * How many bytes have been loaded.
//    */
//   bytesLoaded: number;

//   /**
//    * How many documents have been loaded.
//    */
//   documentsLoaded: number;

//   /**
//    * The current task state.
//    * 
//    * Possible values:
//    * - `"Error"`: The loading task failed.
//    * - `"Running"`: The loading task is still in progress.
//    * - `"Success"`: The loading task completed successfully.
//    */
//   taskState: TaskState;

//   /**
//    * The total number of bytes in the bundle being loaded.
//    */
//   totalBytes: number;

//   /**
//    * The total number of documents in the bundle being loaded.
//    */
//   totalDocuments: number;
// }

// /**
//  * Store utility for handling bundles in IndexedDB.
//  */
// export declare class BundleStore {
//   /**
//    * Constructs a BundleStore using the given configuration.
//    * @param name - The database name
//    * @param objectStoreName - The object store name
//    * @param key - The key path for the object store
//    */
//   constructor(name: string, objectStoreName: string, key: string);

//   /**
//    * Retrieves the entry associated with the given ID from the bundle store.
//    * @param id - The key of the entry to retrieve.
//    * @returns A promise resolving to the found value, or rejects if not found.
//    */
//   get(id: any): Promise<any>;

//   /**
//    * Inserts or updates the provided object in the bundle store.
//    * @param obj - The object to store.
//    * @returns A promise that resolves when the operation is complete.
//    */
//   set(obj: any): Promise<void>;

//   /**
//    * Deletes the entry with the given ID from the bundle store.
//    * @param id - The key of the entry to delete.
//    * @returns A promise that resolves when the delete is complete.
//    */
//   delete(id: any): Promise<void>;

//   /**
//    * Deletes the entire bundle database.
//    * @returns A promise that resolves when the delete is complete.
//    */
//   deleteDB(): Promise<void>;
// }