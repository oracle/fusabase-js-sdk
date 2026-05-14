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

import { DocumentReference } from "../document/reference.js";
import { CollectionReference } from "../collection/reference.js";
import { DocumentData } from "../types/common.js";
import { oracledbErrorHandler } from "../util/utils.js";
import { FieldPath } from "../field/path.js";
import { Oracledb } from "../internal/core.js";
/**
 * Returns a DocumentReference from a CollectionReference and path (and optional path segments).
 */
export function doc<
  AppModelType,
  DbModelType extends DocumentData
>(
  reference: CollectionReference<AppModelType, DbModelType> | DocumentReference<AppModelType,DbModelType> | Oracledb,
  path?: string,
  ...pathSegments: string[]
): DocumentReference<AppModelType, DbModelType> {
  let db = reference as any;

  let converter:any = null;
  if (reference instanceof CollectionReference || reference instanceof DocumentReference) {
      converter = reference.converter;
  }

  if (path == null || path == "") {
      path = crypto.randomUUID();
  }
  if (db instanceof CollectionReference || db instanceof DocumentReference) {
      const temp_path = db.path;
      path = temp_path + '/' +  path;
      db = db.oracledb;
  }
  var path_str = path;
  for (let i = 0; i < pathSegments.length; i++) {
      path_str += '/';
      path_str += pathSegments[i];
  }
  let check_path = path_str.split("/");
  if (check_path.length % 2 == 1) {
      let err = new Error("Provided path is not valid!")  as Error & { status?: number };
      err.status = 400;
      throw oracledbErrorHandler(err);
  }
  let newDocRef = new DocumentReference<AppModelType, DbModelType>(db, path_str);
  newDocRef.withConverter(converter);
  
  return newDocRef;
}

/**
 * Returns a FieldPath that refers to the ID of a document.
 */
export function documentId(): FieldPath {
  return FieldPath.documentId();
}

/**
 * Returns true if two references (DocumentReference or CollectionReference) are logically equal.
 *
 * @param left - The first reference to compare.
 * @param right - The second reference to compare.
 * @returns true if the references are equal.
 */
export function refEqual<
  AppModelType,
  DbModelType extends DocumentData
>(
  left: DocumentReference<AppModelType, DbModelType> | CollectionReference<AppModelType, DbModelType>,
  right: DocumentReference<AppModelType, DbModelType> | CollectionReference<AppModelType, DbModelType>
): boolean {
  return left.isEqual(right as any);
}
