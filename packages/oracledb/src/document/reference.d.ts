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

import { Oracledb } from '../internal/core.js';
import { CollectionReference } from '../collection/reference.js';
import { DocumentData } from '../types/common.js';
import { OracledbDataConverter } from '../types/converter.js';

/**
 * A reference to a Oracledb document.
 * Can be used to read, write, or listen to the document.
 *
 * @template AppModelType - The type of the user-facing model.
 * @template DbModelType - The type of the Oracledb data stored in the database.
 *
 * @example
 * ```ts
 * const docRef = doc(Oracledb, 'users/user123');
 * await setDoc(docRef, { name: "Alice" });
 * ```
 */
export declare class DocumentReference<
  AppModelType = DocumentData,
  DbModelType extends DocumentData = DocumentData
> {
  /**
   * The OracledbDataConverter associated with this reference, or null.
   */
  readonly converter: OracledbDataConverter<AppModelType, DbModelType> | null;

  /**
   * The Oracledb instance this document belongs to.
   */
  readonly oracledb: Oracledb;

  /**
   * The document ID.
   */
  readonly id: string;

  /**
   * The parent collection of this document.
   */
  readonly parent: CollectionReference<AppModelType, DbModelType>;

  /**
   * Path of this document, relative to the root of the database.
   */
  readonly path: string;

  /**
   * Applies a custom data converter to this DocumentReference.
   * Allows using your own model objects with Oracledb.
   *
   * @param converter - OracledbDataConverter to use
   * @returns New DocumentReference instance with the converter applied
   *
   * @example
   * ```ts
   * const converter = {
   *   toOracledb(user: User) { return { name: user.name }; },
   *   fromOracledb(snapshot) { return { name: snapshot.data().name }; }
   * };
   * const docWithConverter = docRef.withConverter(converter);
   * ```
   */
  withConverter<NewAppModelType, NewDbModelType extends DocumentData = DocumentData>(
    converter: OracledbDataConverter<NewAppModelType, NewDbModelType>
  ): DocumentReference<NewAppModelType, NewDbModelType>;

  /**
   * Removes the converter from this DocumentReference.
   */
  withConverter(converter: null): DocumentReference<DocumentData, DocumentData>;

  /**
   * @internal
   */
  isEqual(docRef: DocumentReference): boolean;

  /**
   * @internal
   */
  collection<T = any>(colPath: string): CollectionReference<T>;

  /**
   * @internal
   */
  get(options?: { source: "server" }, trans_obj?: any): Promise<DocumentSnapshot<T>>;

  /**
   * @internal
   */
  update(data: Partial<T>): Promise<void>;
  update(field: string | FieldPath, value: any, ...rest: any[]): Promise<void>;

  /**
   * @internal
   */
  delete(trans_obj?: any): Promise<void>;

  /**
   * @internal
   */
  set(data: T, setOptions?: SetOptions, trans_obj?: any): Promise<void>;

  /**
   * @internal
   */
  onSnapshot(
    next: (snapshot: DocumentSnapshot<T>) => void,
    error?: (err: Error) => void,
    complete?: () => void
  ): () => void;
}

declare class DualityViewDocReference<T = any> {
    /**
   * @internal
   */
    protected _queryHelper: QueryHelper | null;
    /**
   * @internal
   */
    protected _rt: number;
    converter: null;

    readonly type: string;
    id: string;
    parent: DualityViewColReference | null;
    /**
   * @internal
   */
    protected _path: string[];
    oracledb: Oracledb;

    constructor(db: Oracledb, path: string, parent?: DualityViewColReference | null);

    get path(): string;

    /**
   * @internal
   */
    isEqual(docRef: DualityViewDocReference): boolean;

    /**
   * @internal
   */
    get(options?: { source: "server" }, trans_obj?: any): Promise<DocumentSnapshot<T>>;

    /**
   * @internal
   */
    update(data: Partial<T>): Promise<void>;
    update(field: string | FieldPath, value: any, ...rest: any[]): Promise<void>;

    /**
   * @internal
   */
    delete(trans_obj?: any): Promise<void>;

    /**
   * @internal
   */
    set(data: T, setOptions?: SetOptions, trans_obj?: any): Promise<void>;

    withConverter(converter: Converter<T>): DualityViewDocReference<T>;
}