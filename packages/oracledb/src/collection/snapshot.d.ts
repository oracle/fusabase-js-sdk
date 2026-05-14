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

// collection/snapshot.d.ts

/**
 * Represents the results of a query or collection read.
 * Contains an array of DocumentSnapshots and metadata about the snapshot.
 */
export declare class QuerySnapshot<T = any> {
  /** Array of documents in this snapshot */
  readonly docs: Array<DocumentSnapshot<T>>;

  /** Number of documents in the snapshot */
  readonly size: number;

  /** True if snapshot contains no documents */
  readonly empty: boolean;

  /**
   * Iterates over each document in the snapshot.
   *
   * @param callback - Function called for each document.
   *
   * @example
   * ```ts
   * snapshot.forEach(doc => console.log(doc.id, doc.data()));
   * ```
   */
  forEach(callback: (doc: DocumentSnapshot<T>) => void): void;
}
