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

// reference/collectionReference.d.ts

import { DocumentReference } from '../document/reference.js';
import { DocumentData } from '../types/common.ts.js';
import {Oracledb} from '../internal/core.ts.js';
import { AggregateQuery } from './aggregate.ts.js';
import { AggregateField } from './aggregate.ts.js';
import { QuerySnapshot } from './snapshot.ts.js';
import { OracledbDataConverter } from '../types/converter.ts.js';
/**
 * A Query refers to a Oracledb query that can read or listen to documents.
 * Queries can be further refined by applying filters, ordering, and limits.
 *
 * @example
 * ```ts
 * const usersQuery = query(
 *   collection(db, 'users'),
 *   where('age', '>=', 18),
 *   orderBy('age', 'desc')
 * );
 * ```
 */
export declare class Query<AppModelType = DocumentData, DbModelType extends DocumentData = DocumentData> {
  constructor(oracledb: Oracledb);

  /**
   * The Oracledb instance associated with this query.
   */
  oracledb: Oracledb;

  /**
   * Type of this reference: 'query', 'collection', or 'namedquery'.
   */
  type: 'query' | 'collection' | 'namedquery';

  /**
   * Applies column selection to the query.
   *
   * @param {Array} arr - Array of column names.
   * @return {Query} Returns a Query instance.
   */
  column(arr: string[]): Query<AppModelType, DbModelType>;

  /**
   * Applies a custom data converter to this query.
   * When used with getDocs() or onSnapshot(), the converter transforms Oracledb data
   * into your custom app model.
   */
  withConverter<NewAppModelType, NewDbModelType extends DocumentData = DocumentData>(
    converter: OracledbDataConverter<NewAppModelType, NewDbModelType> | null
  ): Query<NewAppModelType, NewDbModelType>;
}


/**
 * A reference to a Oracledb collection.
 * Extends a Query to allow querying and snapshot listening on the collection.
 *
 * @template AppModelType - The type of your application's data model.
 * @template DbModelType - The type of the Oracledb-stored data.
 *
 * @example
 * ```ts
 * import { collection, CollectionReference, addDoc } from 'fusabase/oracledb';
 *
 * const usersCollection: CollectionReference = collection(db, 'users');
 * console.log(usersCollection.id);   // 'users'
 * console.log(usersCollection.path); // 'users'
 *
 * // Adding a document
 * const newUserRef = await addDoc(usersCollection, { name: 'Alice', age: 25 });
 * console.log(newUserRef.id); // auto-generated ID
 * ```
 */
export declare class CollectionReference<
  AppModelType = DocumentData,
  DbModelType extends DocumentData = DocumentData
> extends Query<AppModelType, DbModelType> {
  /**
   * The collection's identifier (last segment of its path).
   */
  readonly id: string;

  /**
   * A reference to the containing DocumentReference if this is a subcollection.
   * Null if this collection is at the root.
   */
  readonly parent: DocumentReference<DocumentData, DocumentData> | null;

  /**
   * The full path of this collection relative to the root of the database.
   */
  readonly path: string;

  /**
   * A type string uniquely identifying this instance.
   */
  readonly type: string;

  /**
   * Applies a custom data converter to this CollectionReference.
   * With the returned CollectionReference, all writes (addDoc, setDoc) will use the converter.
   */
  withConverter<NewAppModelType, NewDbModelType extends DocumentData>(
    converter: OracledbDataConverter<NewAppModelType, NewDbModelType>
  ): CollectionReference<NewAppModelType, NewDbModelType>;
  withConverter(): CollectionReference<AppModelType, DbModelType>;

  /**
   * Returns a DocumentReference for the document in the collection for the path.
   *
   * @param docPath Document ID or relative path.
   */
  /**
   * @internal
   */
  doc<DocAppModelType = AppModelType, DocDbModelType extends DocumentData = DbModelType>(
    docPath: string
  ): DocumentReference<DocAppModelType, DocDbModelType>;

  /**
   * Adds a new document to this collection.
   *
   * @param document Data object for the new document.
   * @returns Promise resolved with a DocumentReference to the new document.
   */
  /**
   * @internal
   */
  add(
    document: AppModelType
  ): Promise<DocumentReference<AppModelType, DbModelType>>;

  /**
   * Checks if this CollectionReference is equal to another CollectionReference.
   */
  /**
   * @internal
   */
  isEqual(
    other: CollectionReference<any, any>
  ): boolean;
}


export declare class DualityViewColReference<T = any> extends Query {
    readonly type: string;
    id: string;
    parent: null;
    converter: null;

    constructor(db: Oracledb, name: string);

    get path(): string;

    /**
   * @internal
   */
    doc<D = any>(docPath: string): DualityViewDocReference<D>;

    /**
   * @internal
   */
    add(data_obj: T): Promise<DualityViewDocReference<T>>;

    /**
   * @internal
   */
    get(): Promise<QuerySnapshot<T>>;

  /**
   * @internal
   */
    isEqual(ref: DualityViewColReference): boolean;
}