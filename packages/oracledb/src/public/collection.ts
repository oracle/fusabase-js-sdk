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

import { Oracledb } from "../internal/core.js";
import { DocumentReference, DualityViewDocReference } from "../document/reference.js";
import { CollectionReference, DualityViewColReference } from "../collection/reference.js";
import { DocumentData } from "../types/common.js";
import { oracledbErrorHandler } from "../util/utils.js";
import { typeStrings } from "../util/utils.js";
import { argCheck } from "../util/utils.js";
import { Query } from "../collection/reference.js";
/**
 * Gets a CollectionReference instance for the specified path.
 *
 * @param db - A Oracledb/Oracledb instance, DocumentReference, or CollectionReference
 * @param path - Path to the collection
 * @param pathSegments - Additional path segments
 * @returns CollectionReference<DocumentData, DocumentData>
 */
export function collection(
  db: Oracledb | DocumentReference<any, any> | CollectionReference<any, any>, 
  path: string, 
  ...pathSegments: string[]
): CollectionReference<DocumentData, DocumentData> {

  if (!(db instanceof Oracledb || db instanceof DocumentReference ||
        db instanceof CollectionReference
    )) {
        let error = new Error("Invalid reference") as Error & { status?: number };
        error.status = 400;
        throw oracledbErrorHandler(error);
    }
    if (path == null) {
        let err = new Error("Path provided cannot be null") as Error & { status?: number };
        err.status = 400;
        throw oracledbErrorHandler(err);
    }
    if (db instanceof CollectionReference
        || db instanceof DocumentReference) {
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
    if (check_path.length % 2 == 0) {
        let err = new Error("Provided path is not valid!") as Error & { status?: number };
        err.status = 400;
        throw oracledbErrorHandler(err);
    }
    return new CollectionReference(db, path_str);
}

/**
 * Returns a reference to a duality view collection.
 */
export function dualityViewCollection(
  db: Oracledb,
  name: string
): DualityViewColReference<DocumentData, DocumentData> {
  if (!(db instanceof Oracledb)) {
    const error = new Error("Invalid reference") as Error & { status?: number };
    error.status = 400;
    throw oracledbErrorHandler(error);
  }
  argCheck(name, "Invalid collection name", true, [typeStrings.STRING]);
  if (name === "") {
    const err = new Error("Duality view collection name cannot be null.") as Error & { status?: number };
    err.status = 400;
    throw oracledbErrorHandler(err);
  }
  return new DualityViewColReference(db, name);
}

/**
 * Returns a reference to a duality view document.
 */
export function dualityViewDoc<
  AppModelType,
  DbModelType extends DocumentData
>(
  db: Oracledb | DualityViewColReference<AppModelType, DbModelType>,
  path: string,
  ...pathSegments: string[]
): DualityViewDocReference<AppModelType, DbModelType> {

  if (!(db instanceof Oracledb || db instanceof DualityViewColReference)) {
      let error = new Error("Invalid reference") as Error & { status?: number };
      error.status = 400;
      throw oracledbErrorHandler(error);
  }
  let converter:any = null;
  if (db instanceof DualityViewColReference) {
      converter = db.converter;
  }

  if (path == null || path == "") {
      path = crypto.randomUUID();
  }
  if (db instanceof DualityViewColReference) {
      const temp_path = db.path;
      path = temp_path + path;
      db = db.oracledb;
  }
  var path_str = path;
  for (let i = 0; i < pathSegments.length; i++) {
      path_str += '/';
      path_str += pathSegments[i];
  }
  let check_path = path_str.split("/");
  if (check_path.length % 2 == 1) {
      let err = new Error("Provided path is not valid!") as Error & { status?: number };
      err.status = 400;
      throw oracledbErrorHandler(err);
  }
  let newDocRef = new DualityViewDocReference<AppModelType, DbModelType>(db, path_str);
  newDocRef.withConverter(converter);
  
  return newDocRef;
}


/**
 * Returns a `CollectionReference` referring to a collection group with the given name.
 * @param oracledb - An Oracledb instance.
 * @param name - The collection group name.
 */
export function collectionGroup(
  oracledb: Oracledb,
  name: string
): Query<DocumentData, DocumentData> {
  if (!(oracledb instanceof Oracledb)) {
    const err = new Error("Invalid database instance") as Error & { status?: number };
    err.status = 400;
    throw oracledbErrorHandler(err);
  }
  return oracledb.collectionGroup(name);
}