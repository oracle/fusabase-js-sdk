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
// import { Oracledb } from "../internal/core.js";
// import { LoadBundleTask } from "../internal/bundle.js";

// /**
//  * Loads a Oracledb bundle.
//  *
//  * @param oracledb - The Oracledb instance.
//  * @param bundleData - Bundle data (string or ArrayBuffer).
//  *
//  * @example
//  * ```ts
//  * const task = loadBundle(oracledb, bundleData);
//  * task.onProgress(progress => console.log(progress));
//  * await task;
//  * ```
//  */
// export declare function loadBundle(Oracledb: Oracledb, bundleData: string | ArrayBuffer): LoadBundleTask;

// /**
//  * Retrieves a named query from a loaded bundle.
//  *
//  * @param oracledb - The Oracledb instance.
//  * @param name - Name of the query.
//  *
//  * @example
//  * ```ts
//  * const query = namedQuery(oracledb, 'recentPosts');
//  * ```
//  */
// export declare function namedQuery(Oracledb: Oracledb, name: string): any; // Query type
