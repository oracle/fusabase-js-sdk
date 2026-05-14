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

// import { TaskState } from "../types/bundle.js";
// import { IndexDBStore } from "./indexdb_storage.js";
// import { parseAndGetTotalBytes,getTotalBytes,oracledbErrorHandler } from "../util/utils.js";
// /**
//  * Represents the progress of loading a Oracledb bundle.
//  */
// export class LoadBundleTaskProgress implements LoadBundleTaskProgress {
//   bytesLoaded: number;
//   documentsLoaded: number;
//   totalBytes: number;
//   taskState: TaskState;
//   totalDocuments: number;

//   constructor(totalBytes: number, totalDocuments: number) {
//     this.bytesLoaded = 0;
//     this.documentsLoaded = 0;
//     this.totalBytes = totalBytes;
//     this.totalDocuments = totalDocuments;
//     this.taskState = TaskState.Running;
//   }
// }

// export class LoadBundleTask implements PromiseLike<LoadBundleTaskProgress> {
//   #data: any;
//   #db: any;
//   #promise: Promise<LoadBundleTaskProgress>;
//   #resolve!: (value: LoadBundleTaskProgress) => void;
//   #reject!: (reason: unknown) => void;
//   #chunkSize: number;
//   taskProgress: LoadBundleTaskProgress;
//   callbacks: {
//     next?: (p: LoadBundleTaskProgress) => unknown;
//     error?: (e: Error) => unknown;
//     complete?: () => void;
//   };

//   constructor(data: any, db: any, chunkSize: number) {
//     this.taskProgress = new LoadBundleTaskProgress(0, 0);
//     this.callbacks = {
//       next: undefined,
//       error: undefined,
//       complete: undefined
//     };
//     this.#db = db;
//     this.#chunkSize = chunkSize;
//     this.#promise = new Promise<LoadBundleTaskProgress>((resolve, reject) => {
//       this.#resolve = resolve;
//       this.#reject = reject;
//     });

//     parseAndGetTotalBytes(data).then(res => {
//       this.#data = res.data;
//       this.taskProgress.totalBytes = res.totalBytes;
//       this.taskProgress.totalDocuments = res.data["documents"].length;
//       this.#initLoad();
//     }).catch(e => {
//       (e as any).status = 500;
//       const baas_error = oracledbErrorHandler(e);
//       this.taskProgress.taskState = TaskState.Error;
//       this.#reject(baas_error);
//       if (this.callbacks.error) this.callbacks.error(baas_error);
//     });
//   }

//   #transformData(): void {
//     const newData = [];
//     for (let j = 0; j < this.#data["queries"].length; j++) {
//       const qObj: any = {
//         name: this.#data["queries"][j]["name"],
//         documents: [],
//         bundleID: this.#data["bundleID"],
//         metadata: this.#data["metadata"]
//       };
//       for (let k = 0; k < this.#data["queries"][j]["doucments"].length; k++) {
//         const docPath = this.#data["queries"][j]["doucments"][k];
//         if (!Object.prototype.hasOwnProperty.call(this.#data["documents"], docPath)) {
//           const err = new Error("Document data is not present.") as Error & { status?: number };
//           err.status = 400;
//           throw oracledbErrorHandler(err);
//         }
//         qObj["documents"].push({
//           path: docPath,
//           data: this.#data["documents"][docPath]
//         });
//       }
//       newData.push(qObj);
//     }
//     this.#data = newData;
//   }

//   async #initLoad(): Promise<void> {
//     this.#transformData();
//     while (true) {
//       let querOffset = 0;
//       let docOffset = 0;
//       const y = Math.min(docOffset + this.#chunkSize, this.#data[querOffset]["documents"].length);
//       let oldData = await this.#db.__getBundleData(this.#data[querOffset]["name"]);
//       let oldBytes = getTotalBytes(oldData);
//       if (oldData == null) {
//         oldData = {
//           name: this.#data[querOffset]["name"],
//           documents: [],
//           bundleID: this.#data[querOffset]["bundleID"],
//           metadata: this.#data[querOffset]["metadata"]
//         };
//       }
//       let ct = 0;
//       for (let j = docOffset; j < y; j++) {
//         ct += 1;
//         oldData["documents"].push(this.#data[querOffset]["documents"][j]);
//       }
//       await this.#db.__setBundleData(oldData);
//       const newBytes = getTotalBytes(oldData);
//       docOffset = y % this.#data[querOffset]["documents"].length;
//       if (docOffset === 0) {
//         querOffset += 1;
//       }
//       this.taskProgress.documentsLoaded += ct;
//       this.taskProgress.bytesLoaded += (newBytes - oldBytes);
//       if (this.taskProgress.documentsLoaded === this.taskProgress.totalDocuments) {
//         this.taskProgress.taskState = TaskState.Success;
//       }
//       if (this.callbacks.next) {
//         this.callbacks.next(this.taskProgress);
//       }
//       if (this.taskProgress.taskState === TaskState.Success) {
//         if (this.callbacks.complete) {
//           this.callbacks.complete();
//         }
//         this.#resolve(this.taskProgress);
//         break;
//       }
//     }
//   }

//   /**
//    * Registers on-progress, on-error, and on-complete handlers.
//    */
//   onProgress(
//     next?: (progress: LoadBundleTaskProgress) => unknown,
//     error?: (err: Error) => unknown,
//     complete?: () => void
//   ): void {
//     this.callbacks.next = next;
//     this.callbacks.error = error;
//     this.callbacks.complete = complete;
//   }

//   /**
//    * Implements PromiseLike.then.
//    */
//   then<T, R>(
//     onFulfilled?: (a: LoadBundleTaskProgress) => T | PromiseLike<T>,
//     onRejected?: (a: Error) => R | PromiseLike<R>
//   ): Promise<T | R> {
//     return this.#promise.then(onFulfilled, onRejected);
//   }

//   /**
//    * Implements PromiseLike.catch.
//    */
//   catch<R>(onRejected: (a: Error) => R | PromiseLike<R>): Promise<R | LoadBundleTaskProgress> {
//     return this.#promise.catch(onRejected);
//   }
// }


// /**
//  * Store utility for handling bundles in IndexedDB.
//  */
// export class BundleStore {
//   private iDBStore: IndexDBStore;

//   /**
//    * Constructs a BundleStore using the given configuration.
//    * @param name - The database name
//    * @param objectStoreName - The object store name
//    * @param key - The key path for the object store
//    */
//   constructor(name: string, objectStoreName: string, key: string) {
//     this.iDBStore = new IndexDBStore(name, objectStoreName, key);
//   }

//   /**
//    * Retrieves the entry associated with the given ID from the bundle store.
//    * @param id - The key of the entry to retrieve.
//    * @returns A promise resolving to the found value, or rejects if not found.
//    */
//   async get(id: any): Promise<any> {
//     return this.iDBStore.get(id);
//   }

//   /**
//    * Inserts or updates the provided object in the bundle store.
//    * @param obj - The object to store.
//    * @returns A promise that resolves when the operation is complete.
//    */
//   async set(obj: any): Promise<void> {
//     await this.iDBStore.set(obj);
//   }

//   /**
//    * Deletes the entry with the given ID from the bundle store.
//    * @param id - The key of the entry to delete.
//    * @returns A promise that resolves when the delete is complete.
//    */
//   async delete(id: any): Promise<void> {
//     await this.iDBStore.delete(id);
//   }

//   /**
//    * Deletes the entire bundle database.
//    * @returns A promise that resolves when the delete is complete.
//    */
//   async deleteDB(): Promise<void> {
//     await this.iDBStore.deleteDB();
//   }
// }