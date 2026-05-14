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

import { App } from "fusabase/app";

/**
 * The `Oracledb` class represents a connection to a Cloud Oracledb database.
 * 
 * It provides access to collections, documents, and operations like reading,
 * writing, and listening to real-time updates.
 * 
 * You obtain an instance of this class by calling {@link getOracledb}.
 *
 * @example
 * ```ts
 * import { initializeApp } from "fusabase/app";
 * import { getOracledb, collection, getDocs } from "fusabase/oracledb";
 *
 * const app = initializeApp({ projectId: "my-project-id" });
 * const db = getOracledb(app);
 *
 * const usersCol = collection(db, "users");
 * const snapshot = await getDocs(usersCol);
 * snapshot.forEach(doc => console.log(doc.id, doc.data()));
 * ```
 */
export declare class Oracledb {
  /**
   * The `App` associated with this Oracledb instance.
   *
   * @example
   * ```ts
   * const app = db.app;
   * console.log(app.name);
   * ```
   */
  readonly app: App;

  /**
   * Indicates whether this instance represents a full Oracledb client
   * or a Oracledb Lite client.
   *
   * Possible values are:
   * - `'oracledb'`
   * - `'oracledb-lite'`
   *
   * @example
   * ```ts
   * console.log(db.type); // 'oracledb'
   * ```
   */
  readonly type: "oracledb" | "oracledb-lite";

  /**
   * Returns a JSON-serializable representation of this Oracledb instance.
   * 
   * Useful for debugging or persisting configuration state.
   *
   * @returns A plain JSON object containing this Oracledb instance’s metadata.
   *
   * @example
   * ```ts
   * console.log(JSON.stringify(db.toJSON(), null, 2));
   * ```
   */
  toJSON(): object;
}
