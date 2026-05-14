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
 * Minimal IndexedDB object store utility for async CRUD operations.
 */
/**
 * @internal
 */
export class IndexDBStore {
  /**
   * @internal
   */
  name: string;
  /**
   * @internal
   */
  objectStoreName: string;
  /**
   * @internal
   */
  key: string;

  /**
   * Create a new IndexDBStore.
   * @param name - Database name
   * @param objectStoreName - Object store name
   * @param key - Key path for object store
   */
  constructor(name: string, objectStoreName: string, key: string) {
    this.name = name;
    this.objectStoreName = objectStoreName;
    this.key = key;
  }

  /**
   * Retrieves the entry associated with the given ID.
   * @param id - The key of the entry to retrieve.
   * @returns A promise resolving to the found value, or rejects if not found.
   */
  /**
   * @internal
   */
  async get(id: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);

      request.onerror = () => {
        reject("An error occurred with IndexedDB");
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore(this.objectStoreName, { keyPath: this.key });
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(this.objectStoreName, "readwrite");
        const store = transaction.objectStore(this.objectStoreName);
        const idQuery = store.get(id);
        idQuery.onsuccess = () => {
          if (idQuery.result == null) {
            reject(new Error("Entry not found!"));
            return;
          }
          resolve(idQuery.result);
        };
        idQuery.onerror = () => {
          reject("Failed to retrieve entry from IndexedDB");
        };
        transaction.oncomplete = () => {
          db.close();
        };
      };
    });
  }

  /**
   * Inserts or updates the provided object in the store.
   * @param obj - The object to put.
   * @returns A promise that resolves when complete.
   */
  /**
   * @internal
   */
  async set(obj: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);

      request.onerror = () => {
        reject("An error occurred with IndexedDB");
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore(this.objectStoreName, { keyPath: this.key });
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(this.objectStoreName, "readwrite");
        const store = transaction.objectStore(this.objectStoreName);
        store.put(obj);
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          reject("Failed to write to IndexedDB");
        };
      };
    });
  }

  /**
   * Deletes the entry with the given ID.
   * @param id - The key of the entry to delete.
   * @returns A promise that resolves when complete.
   */
  /**
   * @internal
   */
  async delete(id: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);

      request.onerror = () => {
        reject("An error occurred with IndexedDB");
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore(this.objectStoreName, { keyPath: this.key });
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(this.objectStoreName, "readwrite");
        const store = transaction.objectStore(this.objectStoreName);
        store.delete(id);
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          reject("Failed to delete from IndexedDB");
        };
      };
    });
  }

  /**
   * Deletes the database entirely.
   * @returns A promise that resolves when complete.
   */
  /**
   * @internal
   */
  async deleteDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const DBDeleteRequest = window.indexedDB.deleteDatabase(this.name);

      DBDeleteRequest.onerror = () => {
        reject("An error occurred with IndexedDB");
      };
      DBDeleteRequest.onsuccess = () => {
        resolve();
      };
    });
  }
}