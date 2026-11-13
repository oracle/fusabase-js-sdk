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
import { safeSetOwn } from "../util/utils_helper.js";
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
  ref: DocumentReference<AppModelType, DbModelType> | DualityViewDocReference<AppModelType, DbModelType>,
  data: unknown
): DocumentData {
  return (ref.converter ? ref.converter.toOracledb(data as any) : data) as DocumentData;
}

async function queueOfflineWrite(
  ref: DocumentReference<any, any> | DualityViewDocReference<any, any>,
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
    safeSetOwn(data, fieldName, fieldValue);
  }
  return data;
}
/**
 * Deletes the referenced document.
 *
 * @param ref - Document reference to delete.
 * @returns A promise that resolves when deletion completes.
 * @example
 * ```ts
 * await deleteDoc(taskRef);
 * ```
 *
 * @example
 * ```ts
 * await deleteDoc(orderViewRef);
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
  if ((ref instanceof DocumentReference || ref instanceof DualityViewDocReference) && _isOfflineEnabled(ref.oracledb)) {
    return queueOfflineWrite(
      ref,
      new OfflineDeleteWrite(
        OracledbDocumentKey.fromPath(ref.path),
        OracledbWritePrecondition.none(),
        [],
        ref instanceof DualityViewDocReference ? 'dualityViewDocument' : 'document'
      )
    );
  }
  return ref.delete(null);
}

/**
 * Writes data to a document, optionally merging it with existing data.
 *
 * @param ref - Document reference to write.
 * @param data - Data to store in the document.
 * @param options - Optional `{ merge }` or `{ mergeFields }` settings.
 * @returns A promise that resolves when the write completes.
 * @example
 * ```ts
 * await setDoc(taskRef, { title: "Plan" }, { merge: true });
 * ```
 *
 * @example
 * ```ts
 * await setDoc(taskRef, { title: "Plan", done: false });
 * ```
 *
 * @example
 * ```ts
 * await setDoc(taskRef, { title: "Plan", done: false }, { mergeFields: ["title"] });
 * ```
 *
 * @example
 * ```ts
 * await setDoc(orderViewRef, { status: "PAID" });
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
  if ((ref instanceof DocumentReference || ref instanceof DualityViewDocReference) && _isOfflineEnabled(ref.oracledb)) {
    const converted = convertData(ref, data);
    const key = OracledbDocumentKey.fromPath(ref.path);
    const isMerge = options?.merge || (options?.mergeFields?.length ?? 0) > 0;
    if (isMerge) {
      await _ensureDocumentCachedForWrite(ref as any);
    }
    const mutation = isMerge
      ? new OfflinePatchWrite(
        key,
        converted,
        options?.mergeFields?.length ? options.mergeFields : Object.keys(converted),
        OracledbWritePrecondition.exists(true),
        [],
        ref instanceof DualityViewDocReference ? 'dualityViewDocument' : 'document'
      )
      : new OfflineSetWrite(
        key,
        converted,
        OracledbWritePrecondition.none(),
        [],
        ref instanceof DualityViewDocReference ? 'dualityViewDocument' : 'document'
      );
    return queueOfflineWrite(ref, mutation);
  }
  return ref.set(data as any, options);
}

/**
 * Adds a document to a collection and returns its reference.
 *
 * @param ref - Collection reference that receives the document.
 * @param data - Document data. In the explicit-ID overload, pass the identifier
 * as the second argument and document data as the third argument.
 * @returns A promise that resolves to the new document reference.
 * @example
 * ```ts
 * const taskRef = await addDoc(tasks, { title: "Plan" });
 * ```
 *
 * @example Create a document with an explicit identifier.
 * ```ts
 * const taskRef = await addDoc(tasks, "task-1", { title: "Plan" });
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
  if (ref instanceof DualityViewColReference && _isOfflineEnabled(ref.oracledb)) {
    const err = new Error(
      "addDoc() cannot be queued offline for a duality view because its document ID is assigned by the server"
    ) as Error & { status?: number; code?: string };
    err.status = 501;
    err.code = "offline-duality-view-add-unsupported";
    throw oracledbErrorHandler(err);
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
 * Updates one or more fields in the referenced document.
 *
 * @param reference - Document reference to update.
 * @param field - First field path. For the object overload, pass an update object
 * as the second argument instead.
 * @param value - Value for the first field-path overload.
 * @param moreFieldsAndValues - Remaining field-path/value pairs.
 * @returns A promise that resolves when the update completes.
 * @example
 * ```ts
 * await updateDoc(taskRef, { done: true });
 * ```
 *
 * @example Update a string field path.
 * ```ts
 * await updateDoc(taskRef, "done", true);
 * ```
 *
 * @example FieldPath and field/value pairs
 * ```ts
 * await updateDoc(taskRef, new FieldPath("status", "done"), true, "priority", 1);
 * ```
 */
export function updateDoc<AppModelType, DbModelType extends DocumentData>
(reference: DocumentReference<AppModelType, DbModelType> | DualityViewDocReference<AppModelType, DbModelType>,
  field: string | FieldPath, value: unknown,
  ...moreFieldsAndValues: unknown[]): Promise<void>;
export function updateDoc<AppModelType, DbModelType extends DocumentData>
(ref: DocumentReference<AppModelType, DbModelType> | DualityViewDocReference<AppModelType, DbModelType>,
   data: UpdateData<DbModelType>): Promise<void>;

export async function updateDoc<AppModelType, DbModelType extends DocumentData>(
  ref: DocumentReference<AppModelType, DbModelType> | DualityViewDocReference<AppModelType, DbModelType>,
  fieldOrData: string | FieldPath | UpdateData<DbModelType>,
  value?: unknown,
  ...moreFieldsAndValues: unknown[]
): Promise<void> {
  if ((ref instanceof DocumentReference || ref instanceof DualityViewDocReference) && _isOfflineEnabled(ref.oracledb)) {
    await _ensureDocumentCachedForWrite(ref as any);
    const data = updateArgsToData(fieldOrData, value, moreFieldsAndValues);
    return queueOfflineWrite(
      ref,
      new OfflinePatchWrite(
        OracledbDocumentKey.fromPath(ref.path),
        data,
        Object.keys(data),
        OracledbWritePrecondition.exists(true),
        [],
        ref instanceof DualityViewDocReference ? 'dualityViewDocument' : 'document'
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

/**
 * Creates a bulk-update builder for a document-data service or path.
 *
 * @param reference - Document-data service that owns the target path.
 * @param path - Optional path to update.
 * @returns The bulk-update builder.
 * @example
 * ```ts
 * const updates = updateDocs(database, "tasks");
 * ```
 */
export function updateDocs<
  AppModelType,
  DbModelType extends DocumentData
>(
  reference: Oracledb,
  path?: string
): BulkUpdate<AppModelType, DbModelType> {
  return reference.updateDocs(path ?? "");
}
