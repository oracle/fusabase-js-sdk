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

import { oracledbErrorHandler } from "../util/utils.js";
import { DocumentData } from "../types/common.js";
import { DocumentReference, DualityViewDocReference } from "../document/reference.js";
import { SetOptions } from "../types/common.js";
import { UpdateData } from "../types/common.js";
import { CollectionReference, DualityViewColReference } from "../collection/reference.js";
import { PartialWithFieldValue, WithFieldValue } from "../types/data.js";
import { FieldPath } from "../field/path.js";
import { Oracledb } from "../internal/core.js";
import { BulkUpdate } from "../transaction/bulk.js";
/**
 * Deletes the document referenced by `ref`.
 */
export async function deleteDoc<
  AppModelType,
  DbModelType extends DocumentData
>(
  ref: DocumentReference<AppModelType, DbModelType> | DualityViewDocReference<AppModelType>
): Promise<void> {
  if (
    !(ref instanceof DocumentReference) &&
    !(ref instanceof DualityViewDocReference)
  ) {
    const err = new Error("Provided reference is not valid!") as Error & { status?: number };
    err.status = 400;
    throw oracledbErrorHandler(err);
  }
  return ref.delete(null);
}

/**
 * Sets data on a document, optionally merging with existing data.
 */
export async function setDoc<
  AppModelType,
  DbModelType extends DocumentData
>(
  ref: DocumentReference<AppModelType, DbModelType> | DualityViewDocReference<AppModelType>,
  data: PartialWithFieldValue<AppModelType>,
  options?: SetOptions
): Promise<void> {
  if (
    !(ref instanceof DocumentReference) &&
    !(ref instanceof DualityViewDocReference)
  ) {
    const err = new Error("Provided reference is not valid!") as Error & { status?: number };
    err.status = 400;
    throw oracledbErrorHandler(err);
  }
  return ref.set(data as any, options);
}

/**
 * Adds a document to a collection and returns its reference.
 */
export async function addDoc<
  AppModelType,
  DbModelType extends DocumentData
>(
  ref:
    | CollectionReference<AppModelType, DbModelType>
    | DualityViewColReference<AppModelType>,
  data: WithFieldValue<AppModelType>
): Promise<DocumentReference<AppModelType, DbModelType>|DualityViewDocReference<AppModelType>> {
  if (
    !(ref instanceof CollectionReference) &&
    !(ref instanceof DualityViewColReference)
  ) {
    const err = new Error("Provided reference is not valid!") as Error & { status?: number };
    err.status = 400;
    throw oracledbErrorHandler(err);
  }
  // TS note: TS users will get type checks on the call site
  return ref.add(data);
}

/**
 * Updates fields in the referenced document.
 */
export function updateDoc<AppModelType, DbModelType extends DocumentData>
(reference: DocumentReference<AppModelType, DbModelType>,
  field: string | FieldPath, value: unknown,
  ...moreFieldsAndValues: unknown[]): Promise<void>;
export function updateDoc<AppModelType, DbModelType extends DocumentData>
(ref: DocumentReference<AppModelType, DbModelType>,
   data: UpdateData<DbModelType>): Promise<void>;

export function updateDoc<AppModelType, DbModelType extends DocumentData>(
  ref: DocumentReference<AppModelType, DbModelType>,
  fieldOrData: string | FieldPath | UpdateData<DbModelType>,
  value?: unknown,
  ...moreFieldsAndValues: unknown[]
): Promise<void> {
  if (arguments.length === 2) {
    return ref.update(fieldOrData);
  } else {
    const [, ...rest] = arguments;
    return ref.update(...rest);
  }
}

export function updateDocs<
  AppModelType,
  DbModelType extends DocumentData
>(
  reference: Oracledb,
  path?: string
): BulkUpdate<AppModelType, DbModelType> {
  return reference.updateDocs(path ?? "");
}