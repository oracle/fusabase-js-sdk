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

import { QueryCompositeFilterConstraint , QueryFieldFilterConstraint} from "../collection/constraint.js";

import { AggregateField } from "../collection/aggregate.js";
import { QueryDocumentSnapshot } from "../document/snapshot.js";
import { FieldPath } from "../field/path.js";
import { FieldValue } from "../field/value.js";

export declare type WhereFilterOp = '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'array-contains-any' | 'not-in';

export declare type QueryConstraintType = 'where' | 'orderBy' | 'limit' | 'limitToLast' | 'startAt' | 'startAfter' | 'endAt' | 'endBefore' | 'join' | 'vectorSearch';

export declare type QueryType = 'query' | 'collection' | 'namedQuery' | 'dualityviewcollection';

export declare type QueryFilterConstraint = QueryFieldFilterConstraint | QueryCompositeFilterConstraint;
/**
 * AggregateFieldType defines the possible aggregation operations
 * available for Oracledb queries, such as `count`, `sum`, and `average`.
 */
export type AggregateFieldType = 'count' | 'sum' | 'average';

/**
 * A utility type that adds a prefix to the keys of an object, transforming
 * keys from `foo` to `prefix.foo`. This can be helpful when nesting objects
 * for aggregation or when working with Oracledb queries that require such transformations.
 * 
 * @template T The object type to modify.
 * @template P The prefix to add to the keys.
 */
export type AddPrefixToKeys<Prefix extends string, T extends Record<string, unknown>> = {
    [K in keyof T & string as `${Prefix}.${K}`]+?: string extends K ? any : T[K];
};

/**
 * AggregateType is simply an alias for AggregateFieldType, specifying
 * the allowed values for an aggregation operation type.
 */
export type AggregateType = AggregateFieldType;

/**
 * AggregateSpec defines the structure of an object that specifies aggregations
 * for Oracledb queries, where each key can represent an aggregate field.
 * For example, you might have:
 *   - count: { countField: AggregateField<'count'> },
 *   - sum: { sumField: AggregateField<'sum'> },
 * Each field in the specification will be an AggregateField that can either be `count`, `sum`, or `average`.
 * 
 * @example
 * const aggregationSpec: AggregateSpec = {
 *   userCount: new AggregateField('count'),
 *   totalSales: new AggregateField('sum'),
 * };
 */
export declare interface AggregateSpec {
  [key: string]: AggregateField<any> | undefined;
}

/**
 * AggregateSpecData transforms an AggregateSpec type into a more specific
 * type, where each aggregation operation’s return type (like number for sum, 
 * count, etc.) is inferred and used directly.
 * 
 * This makes it easy to extract the actual type of each aggregation
 * from the AggregateSpec object.
 * 
 * @template T The AggregateSpec type to transform.
 */
export declare type AggregateSpecData<T extends AggregateSpec> = {
  [P in keyof T]: T[P] extends AggregateField<infer U> ? U : never;
};


/**
 * Defines valid ordering directions for queries.
 */
export type OrderByDirection = 'asc' | 'desc';


/**
 * Represents document data for Oracledb.
 *
 * @example
 * ```ts
 * const data: DocumentData = { name: "Alice", age: 25 };
 * ```
 */
export interface DocumentData {
  [field: string]: any;
}

/**
 * Represents data for updating a document.
 *
 * @example
 * ```ts
 * const update: UpdateData = { age: 26, location: "NY" };
 * ```
 */
// export interface UpdateData <T = any> {
//   [field: string]: any;
// }
export type Primitive = string | number | boolean | undefined | null;
export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
export type ChildUpdateFields<K extends string, V> = V extends Record<string, unknown>
 ? AddPrefixToKeys<K, UpdateData<V>> : never;
export type NestedUpdateFields<T extends Record<string, unknown>> = UnionToIntersection<{
    [K in keyof T & string]: ChildUpdateFields<K, T[K]>;
}[keyof T & string]>;
export type UpdateData<T> = T extends Primitive ? T : T extends {} ? {
    [K in keyof T]?: UpdateData<T[K]> | FieldValue;
} & NestedUpdateFields<T> : Partial<T>;

/**
 * Options for setDoc().
 *
 * @example
 * ```ts
 * await setDoc(docRef, data, { merge: true });
 * ```
 */
export interface SetOptions {
  merge?: boolean;
  mergeFields?: string[];
}

/**
 * Options to configure the behavior of a Oracledb Transaction.
 */
export declare interface TransactionOptions {
  /**
   * Maximum number of attempts to commit the transaction before failing.
   * 
   * Default: 5
   */
  maxAttempts?: number;
}


/**
 * Persistence settings for IndexedDB.
 */
export interface PersistenceSettings {
  synchronizeTabs?: boolean;
  experimentalTabSynchronization?: boolean;
}

/**
 * Settings for in-memory cache.
 */
export interface MemoryCacheSettings {
  cacheSizeBytes?: number;
}

/**
 * Represents a single change to a document in a QuerySnapshot.
 *
 * @template AppModelType - Type of the application's data model.
 * @template DbModelType - Type of the Oracledb-stored data.
 *
 * @example
 * ```ts
 * import { onSnapshot, collection } from 'fusabase/oracledb';
 *
 * const usersCollection = collection(db, 'users');
 * onSnapshot(usersCollection, (snapshot) => {
 *   snapshot.docChanges().forEach((change) => {
 *     if (change.type === 'added') {
 *       console.log('New user:', change.doc.data());
 *     } else if (change.type === 'modified') {
 *       console.log('Modified user:', change.doc.data());
 *     } else if (change.type === 'removed') {
 *       console.log('Removed user:', change.doc.data());
 *     }
 *   });
 * });
 * ```
 */
export declare interface DocumentChange<
  AppModelType = DocumentData,
  DbModelType extends DocumentData = DocumentData
> {
  /**
   * The document affected by this change.
   */
  readonly doc: QueryDocumentSnapshot<AppModelType, DbModelType>;

  /**
   * The index of the changed document in the result set immediately after
   * this change has been applied.
   * -1 for 'removed' events.
   */
  readonly newIndex: number;

  /**
   * The index of the changed document in the result set immediately before
   * this change has been applied.
   * -1 for 'added' events.
   */
  readonly oldIndex: number;

  /**
   * The type of change: 'added', 'modified', or 'removed'.
   */
  readonly type: 'added' | 'modified' | 'removed';
}
