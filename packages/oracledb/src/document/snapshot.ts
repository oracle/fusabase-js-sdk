
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

import { DocumentData } from '../types/common.js';
import { DocumentReference } from './reference.js';
import { SnapshotMetadata } from '../listener/snapshot.js';
import { oracledbErrorHandler } from '../util/utils.js';
import { argCheck, typeStrings, Utils } from '../util/utils.js';
import { parseTimeInDocument } from '../util/utils_helper.js';
import { FieldPath } from '../field/path.js';
import { SnapshotOptions } from '../types/snapshot.js';
import { DualityViewDocReference } from '../document/reference.js';

/**
 * Represents the data read from a document reference.
 *
 * @example
 * ```ts
 * const snapshot = await getDoc(taskRef);
 * ```
 */
export class DocumentSnapshot<
  AppModelType = DocumentData,
  DbModelType extends DocumentData = DocumentData
> {
  /** @internal */
  /** @internal */  _data: AppModelType | null;
/** Describes the public `metadata` value. */
  metadata: SnapshotMetadata;
/** Describes the public `ref` value. */
  ref: any;
  private _converted_data: AppModelType | null;
  /** @internal */
  /** @internal */  _otherMetadata: Record<string, any>;
  /** @internal */  __version: string | null;
  /** @internal */  __rowId: string | null;

/**
 * Constructs a DocumentSnapshot instance with the supplied configuration.
 *
 * @param data - The document or request data to write.
 * @param ref - The ref accepted by this operation.
 * @param metadata - The metadata accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { DocumentSnapshot } from "fusabase/oracledb";
 * const result = new DocumentSnapshot({ title: "Example" }, value, { title: "Example" });
 * void result;
 * ```
 */
  constructor(
    data?: any,
    ref?: DocumentReference<AppModelType, DbModelType> | DualityViewDocReference<AppModelType, DbModelType>,
    metadata: SnapshotMetadata = new SnapshotMetadata(false, false)
  ) {
    this._data = data != null ? parseTimeInDocument(data["DOCUMENT"]) : null;
    this.metadata = metadata;
    this.ref = ref!;
    this._converted_data = null;
    this._otherMetadata = {};
    this._otherMetadata["LAST_MODIFIED"] = data ? data["LAST_MODIFIED"] : null;
    this._otherMetadata["updateTime"] = data ? (data["updateTime"] ?? data["LAST_MODIFIED"] ?? null) : null;
    this._otherMetadata["commitTime"] = data ? (data["commitTime"] ?? data["COMMIT_TIME"] ?? null) : null;
    this._otherMetadata["CREATED"] = data ? data["CREATED"] : null;
    this._otherMetadata["SUBCOLLECTION"] = data ? data["SUBCOLLECTION"] : null;
    this._otherMetadata["PARENT_OID"] = data ? data["PARENT_OID"] : null;
    this._otherMetadata["VERSION"] = null;
    this._otherMetadata["ASOF"] = data ? data["ASOF"] : null;
    this.__version = null;
    this.__rowId = null;
    if (data != null && data["VERSION"]) {
      this.__version = data["VERSION"];
      this._otherMetadata["VERSION"] = data["VERSION"];
    } else if (data != null && data["BAAS_VERSION"]) {
      this.__version = data["BAAS_VERSION"];
      this._otherMetadata["VERSION"] = data["BAAS_VERSION"];
    }
    if (data != null && data["ROWID"]) {
      this.__rowId = data["ROWID"];
    }

    if (this._converted_data == null && this.ref.converter != null) {
      this._converted_data = this.ref.converter.fromOracledb(this as any);
    }
  }

  get id(): string {
    return this.ref == null ? null as any : this.ref.id;
  }

/**
 * Executes the exists operation for this public SDK type.
 *
 * @returns The result produced by `exists`, including any requested data or handle.
 * @example
 * ```ts
 * import { DocumentSnapshot } from "fusabase/oracledb";
 * const result = client.exists();
 * void result;
 * ```
 */
  exists(): boolean {
    return this._data != null;
  }

/**
 * Executes the data operation for this public SDK type.
 *
 * @param options - Optional settings that change this operation.
 * @returns The result produced by `data`, including any requested data or handle.
 * @example
 * ```ts
 * import { DocumentSnapshot } from "fusabase/oracledb";
 * const result = client.data(value);
 * void result;
 * ```
 */
  data(options?: { serverTimestamps?: 'estimate' | 'previous' | 'none' }): AppModelType | undefined {
    return this._converted_data ?? this._data ?? undefined;
  }

/**
 * Executes the get operation for this public SDK type.
 *
 * @param fieldPath - The fieldPath accepted by this operation.
 * @param options - Optional settings that change this operation.
 * @returns The result produced by `get`, including any requested data or handle.
 * @example
 * ```ts
 * import { DocumentSnapshot } from "fusabase/oracledb";
 * const result = get("example", value);
 * void result;
 * ```
 */
  get<K extends keyof AppModelType>(
    fieldPath: K | string,
    options?: { serverTimestamps?: 'estimate' | 'previous' | 'none' }
  ): AppModelType[K] | undefined {
    if (!this.exists()) {
      const err = new Error("Document does not exist!") as Error & { status?: number };
      err.status = 404;
      throw oracledbErrorHandler(err);
    }
    if (fieldPath instanceof FieldPath) {
      return Utils.getObjectProperty(this._data, fieldPath.fullPath);
    }
    argCheck(fieldPath, "Invalid field name.", true, [typeStrings.STRING]);
    if (Utils.memberExists(this._data as any, fieldPath)) {
      return (this._data as any)[fieldPath];
    }
    return undefined;
  }

  // toJSON(): object {
  //   return JSON.parse(JSON.stringify(this));
  // }

  /** @internal */
  _jsonObject(): object {
    return {
      _data: this._data,
      metadata: this.metadata,
      _otherMetadata: this._otherMetadata,
      __version: this.__version,
      __rowId: this.__rowId,
      ref: {
        _path: this.ref._path,
        type: this.ref.type
      }
    };
  }

/**
 * Executes the isEqual operation for this public SDK type.
 *
 * @param snap - The snap accepted by this operation.
 * @returns The result produced by `isEqual`, including any requested data or handle.
 * @example
 * ```ts
 * import { DocumentSnapshot } from "fusabase/oracledb";
 * const result = client.isEqual(value);
 * void result;
 * ```
 */
  isEqual(snap: DocumentSnapshot<AppModelType, DbModelType>): boolean {
    if (!(snap instanceof DocumentSnapshot)) {
      const error = new Error("The other instance to be compared should be an instance of DocumentSnapshot") as Error & { status?: number };
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    return JSON.stringify(snap.data()) === JSON.stringify(this.data());
  }

  /**
   * @internal
   */
  static _parse<T = DocumentData, D extends DocumentData = DocumentData>(
    obj: any,
    ref: DocumentReference<T, D>
  ): DocumentSnapshot<T, D> {
    return new DocumentSnapshot({
      "DOCUMENT": (obj as any)._data,
      "VERSION": (obj as any).__version,
      "ROWID": (obj as any).__rowId,
      "CREATED": (obj as any)._otherMetadata["CREATED"],
      "LAST_MODIFIED": (obj as any)._otherMetadata["LAST_MODIFIED"],
      "updateTime": (obj as any)._otherMetadata["updateTime"],
      "commitTime": (obj as any)._otherMetadata["commitTime"],
      "SUBCOLLECTION": (obj as any)._otherMetadata["SUBCOLLECTION"],
      "ASOF": (obj as any)._otherMetadata["ASOF"],
      "PARENT_OID": (obj as any)._otherMetadata["PARENT_OID"],
    },
    ref,
    new SnapshotMetadata(
      (obj as any).metadata.fromCache,
      (obj as any).metadata.hasPendingWrites
    ));
  }
}

/**
 * Represents an existing document returned by a query.
 *
 * @example
 * ```ts
 * const snapshot = await getDocs(tasksQuery);
 * ```
 */
export class QueryDocumentSnapshot<
  AppModelType = DocumentData,
  DbModelType extends DocumentData = DocumentData
> extends DocumentSnapshot<AppModelType, DbModelType> {
  // constructor(
  //   data: any,
  //   ref: DocumentReference<AppModelType, DbModelType> | DualityViewDocReference<AppModelType, DbModelType>,
  //   metadata: SnapshotMetadata
  // ) {
  //   super(data, ref, metadata);
  // }

/**
 * Executes the data operation for this public SDK type.
 *
 * @param options - Optional settings that change this operation.
 * @returns The result produced by `data`, including any requested data or handle.
 * @example
 * ```ts
 * import { QueryDocumentSnapshot } from "fusabase/oracledb";
 * const result = client.data(value);
 * void result;
 * ```
 */
  data(options?: SnapshotOptions): AppModelType {
    // this._data and this._converted_data can be null only if the doc doesn't exist;
    // but for QueryDocumentSnapshot, the document is guaranteed to exist.
    // If not, throw to signal internal misuse/misconstruction.
    const d = super.data(options);
    if (d == null) {
      throw new Error(
        "QueryDocumentSnapshot.data() called on a non-existent document. This should never happen."
      );
    }
    return d;
  }

  /**
   * @internal
   */
  static _parse<T = DocumentData, D extends DocumentData = DocumentData>(
    obj: any,
    ref: DocumentReference<T, D>
  ): QueryDocumentSnapshot<T, D> {
    return new QueryDocumentSnapshot(
      {
        "DOCUMENT": (obj as any)._data,
        "VERSION": (obj as any).__version,
        "ROWID": (obj as any).__rowId,
        "CREATED": (obj as any)._otherMetadata["CREATED"],
        "LAST_MODIFIED": (obj as any)._otherMetadata["LAST_MODIFIED"],
        "updateTime": (obj as any)._otherMetadata["updateTime"],
        "commitTime": (obj as any)._otherMetadata["commitTime"],
        "SUBCOLLECTION": (obj as any)._otherMetadata["SUBCOLLECTION"],
        "ASOF": (obj as any)._otherMetadata["ASOF"],
        "PARENT_OID": (obj as any)._otherMetadata["PARENT_OID"]
      },
      ref,
      new SnapshotMetadata(
        (obj as any).metadata.fromCache,
        (obj as any).metadata.hasPendingWrites
      )
    );
  }
}
