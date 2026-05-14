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

// import { oracledbErrorHandler } from "../util/utils.js";

// /**
//  * Creates a new document in the given collection.
//  *
//  * @param colRef - Collection reference
//  * @param document - Document data to be stored
//  * @param access_token - Optional access token for authorization
//  * @param transObj - Optional transaction object
//  * @returns A promise resolving to the created document response
//  */
// export async function createDocument<T = any>(
//   colRef: CollectionReference<T>,
//   document: Record<string, unknown>,
//   transObj?: Record<string, unknown>
// ): Promise<T> {
//   const _db = colRef.oracledb;

//   const reqURL =
//     _db.url +
//     endpoints.ADD_DOC +
//     `?apiKey=${_db.app.options.appID}`;

//   const body: Record<string, unknown> = {
//     options: { merge: false },
//     data: document,
//   };

//   if (checkOracledbApiVersion(_db.app.options, OracledbVersion.VER_2)) {
//     body["apiversion"] = 2;
//   }

//   const params: RequestInit & { headers: Record<string, string> } = {
//     method: "POST",
//     headers: {
//       "x-transaction": JSON.stringify(transObj ?? {}),
//     },
//     body: JSON.stringify(body),
//   };

//   const access_token = await getAccessToken(_db.app);

//   if (access_token) {
//     params.headers["Authorization"] = `Bearer ${access_token}`;
//   }

//   return makeRequest<T>(params, reqURL, _db.app);
// }
