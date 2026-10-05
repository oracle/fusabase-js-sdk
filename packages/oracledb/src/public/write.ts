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
import {
  OfflineDeleteWrite,
  OfflinePatchWrite,
  OfflineSetWrite,
  OracledbDocumentKey,
  OracledbWritePrecondition,
} from "../model/index.js";
import {
  _assertDocumentDoesNotExistInCache,
  _ensureDocumentCachedForWrite,
  _isOfflineEnabled,
  _writeLocallyIfEnabled,
} from "./offline.js";

function convertData<AppModelType, DbModelType extends DocumentData>(
  ref: DocumentReference<AppModelType, DbModelType>,
  data: unknown
): DocumentData {
  return (ref.converter ? ref.converter.toOracledb(data as any) : data) as DocumentData;
}

async function queueOfflineWrite(
  ref: DocumentReference<any, any>,
  mutation: OfflineSetWrite | OfflinePatchWrite | OfflineDeleteWrite
): Promise<void> {
  await _writeLocallyIfEnabled(ref.oracledb, [mutation]);
}

function localAutoId(): string {
  const randomUUID = (globalThis.crypto as any)?.randomUUID;
  if (typeof randomUUID !== 'function') {
    throw new Error('crypto.randomUUID is required for offline addDoc');
  }
  return randomUUID.call(globalThis.crypto);
}

function updateArgsToData(
  fieldOrData: string | FieldPath | UpdateData<any>,
  value?: unknown,
  moreFieldsAndValues: unknown[] = []
): DocumentData {
  if (typeof fieldOrData === 'object' && !(fieldOrData instanceof FieldPath)) {
    return fieldOrData as DocumentData;
  }
  const data: DocumentData = {};
  const fields = [fieldOrData, value, ...moreFieldsAndValues];
  for (let index = 0; index < fields.length; index += 2) {
    const field = fields[index];
    const fieldValue = fields[index + 1];
    const fieldName = field instanceof FieldPath ? field.fullPath : String(field);
    data[fieldName] = fieldValue;
  }
  return data;
}
/**
 * Deletes the document referenced by `ref`.
 *
 * @param ref - The document reference to delete.
 * @returns A promise that resolves when the delete is accepted locally or remotely.
 * @example
 * ```ts
 * await deleteDoc(profile);
 * ```
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
  if (ref instanceof DocumentReference && _isOfflineEnabled(ref.oracledb)) {
    return queueOfflineWrite(
      ref,
      new OfflineDeleteWrite(
        OracledbDocumentKey.fromPath(ref.path),
        OracledbWritePrecondition.none()
      )
    );
  }
  return ref.delete(null);
}

/**
 * Sets data on a document, optionally merging with existing data.
 *
 * @param ref - The document reference to write.
 * @param data - Data to store in the document.
 * @param options - Optional merge behavior.
 * @returns A promise that resolves when the write is accepted locally or remotely.
 * @example
 * ```ts
 * await setDoc(profile, { name: 'Ada' }, { merge: true });
 * ```
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
  if (ref instanceof DocumentReference && _isOfflineEnabled(ref.oracledb)) {
    const converted = convertData(ref, data);
    const key = OracledbDocumentKey.fromPath(ref.path);
    const isMerge = options?.merge || (options?.mergeFields?.length ?? 0) > 0;
    if (isMerge) {
      await _ensureDocumentCachedForWrite(ref);
    }
    const mutation = isMerge
      ? new OfflinePatchWrite(
        key,
        converted,
        options?.mergeFields?.length ? options.mergeFields : Object.keys(converted),
        OracledbWritePrecondition.exists(true)
      )
      : new OfflineSetWrite(
        key,
        converted,
        OracledbWritePrecondition.none()
      );
    return queueOfflineWrite(ref, mutation);
  }
  return ref.set(data as any, options);
}

/**
 * Adds a document to a collection and returns its reference.
 *
 * @param ref - The collection reference that receives the document.
 * @param idOrData - Document data, or an explicit identifier when `data` is supplied.
 * @param data - Data to store when an explicit identifier is supplied.
 * @returns A promise resolving to the new document reference.
 * @example
 * ```ts
 * const profile = await addDoc(profiles, { name: 'Ada' });
 * ```
 */
export async function addDoc<
  AppModelType,
  DbModelType extends DocumentData
>(
  ref:
    | CollectionReference<AppModelType, DbModelType>
    | DualityViewColReference<AppModelType>,
  data: WithFieldValue<AppModelType>
): Promise<DocumentReference<AppModelType, DbModelType>|DualityViewDocReference<AppModelType>>;
export async function addDoc<
  AppModelType,
  DbModelType extends DocumentData
>(
  ref:
    | CollectionReference<AppModelType, DbModelType>
    | DualityViewColReference<AppModelType>,
  idOrData: string | WithFieldValue<AppModelType>,
  data?: WithFieldValue<AppModelType>
): Promise<DocumentReference<AppModelType, DbModelType>|DualityViewDocReference<AppModelType>> {
  if (
    !(ref instanceof CollectionReference) &&
    !(ref instanceof DualityViewColReference)
  ) {
    const err = new Error("Provided reference is not valid!") as Error & { status?: number };
    err.status = 400;
    throw oracledbErrorHandler(err);
  }
  if (ref instanceof CollectionReference && _isOfflineEnabled(ref.oracledb)) {
    const hasExplicitId = typeof idOrData === 'string';
    const docId = hasExplicitId ? idOrData : localAutoId();
    const docData = hasExplicitId ? data : idOrData;
    const docRef = ref.doc(docId);
    if (hasExplicitId) {
      await _assertDocumentDoesNotExistInCache(docRef);
    }
    const converted = convertData(docRef, docData);
    await queueOfflineWrite(
      docRef,
      new OfflineSetWrite(
        OracledbDocumentKey.fromPath(docRef.path),
        converted,
        OracledbWritePrecondition.exists(false)
      )
    );
    return docRef;
  }
  if (typeof idOrData === 'string') {
    const docRef = ref instanceof CollectionReference ? ref.doc(idOrData) : null;
    if (!docRef) {
      const err = new Error("addDoc(collectionRef, id, data) is not supported for duality view collections") as Error & { status?: number };
      err.status = 400;
      throw oracledbErrorHandler(err);
    }
    await docRef.set(data as any);
    return docRef;
  }
  // TS note: TS users will get type checks on the call site
  return ref.add(idOrData);
}

/**
 * Updates fields in the referenced document.
 *
 * @param ref - The document reference to update.
 * @param fieldOrData - A field name and value, or an object containing field updates.
 * @param value - The value associated with `fieldOrData` when it is a field name.
 * @param moreFieldsAndValues - Additional field/value pairs.
 * @returns A promise that resolves when the update is accepted locally or remotely.
 * @example
 * ```ts
 * await updateDoc(profile, { status: 'active' });
 * ```
 */
export function updateDoc<AppModelType, DbModelType extends DocumentData>
(reference: DocumentReference<AppModelType, DbModelType>,
  field: string | FieldPath, value: unknown,
  ...moreFieldsAndValues: unknown[]): Promise<void>;
export function updateDoc<AppModelType, DbModelType extends DocumentData>
(ref: DocumentReference<AppModelType, DbModelType>,
   data: UpdateData<DbModelType>): Promise<void>;

export async function updateDoc<AppModelType, DbModelType extends DocumentData>(
  ref: DocumentReference<AppModelType, DbModelType>,
  fieldOrData: string | FieldPath | UpdateData<DbModelType>,
  value?: unknown,
  ...moreFieldsAndValues: unknown[]
): Promise<void> {
  if (ref instanceof DocumentReference && _isOfflineEnabled(ref.oracledb)) {
    await _ensureDocumentCachedForWrite(ref);
    const data = updateArgsToData(fieldOrData, value, moreFieldsAndValues);
    return queueOfflineWrite(
      ref,
      new OfflinePatchWrite(
        OracledbDocumentKey.fromPath(ref.path),
        data,
        Object.keys(data),
        OracledbWritePrecondition.exists(true)
      )
    );
  }
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
