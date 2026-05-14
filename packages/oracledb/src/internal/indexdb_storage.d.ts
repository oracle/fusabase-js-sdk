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

/**
 * Interface for a minimal IndexedDB object store utility.
 */
// export declare class IndexDBStore {
//   name: string;
//   objectStoreName: string;
//   key: string;

//   /**
//    * Create a new IndexDBStore.
//    * @param name - Database name
//    * @param objectStoreName - Object store name
//    * @param key - Key path for object store
//    */
//   constructor(name: string, objectStoreName: string, key: string);

//   /**
//    * Retrieves the entry associated with the given ID.
//    * @param id - The key of the entry to retrieve.
//    * @returns A promise resolving to the found value, or rejects if not found.
//    */
//   get(id: any): Promise<any>;

//   /**
//    * Inserts or updates the provided object in the store.
//    * @param obj - The object to put.
//    * @returns A promise that resolves when complete.
//    */
//   set(obj: any): Promise<void>;

//   /**
//    * Deletes the entry with the given ID.
//    * @param id - The key of the entry to delete.
//    * @returns A promise that resolves when complete.
//    */
//   delete(id: any): Promise<void>;

//   /**
//    * Deletes the database.
//    * @returns A promise that resolves when complete.
//    */
//   deleteDB(): Promise<void>;
// }
// export default IndexDBStore;