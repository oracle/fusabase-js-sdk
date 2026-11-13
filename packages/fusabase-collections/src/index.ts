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

/**
 * Convenience entrypoint that combines application, authentication, storage,
 * UI, and document-data APIs.
 *
 * @packageDocumentation
 */
export * from "../../app/src/index.js";
export * from "../../auth/src/index.js";
export * from "../../storage/src/index.js";
export * from "../../ui/src/index.js";
export {
  AggregateField,
  AggregateQuery,
  AggregateQuerySnapshot,
  CollectionReference,
  DocumentReference,
  DocumentSnapshot,
  DualityViewColReference,
  DualityViewDocReference,
  FieldPath,
  FieldValue,
  LogLevel,
  Oracledb,
  OracledbError,
  OracledbErrorCode,
  Query,
  QueryCompositeFilterConstraint,
  QueryConstraint,
  QueryDocumentSnapshot,
  QueryEndAtConstraint,
  QueryFieldFilterConstraint,
  QueryFieldJoinsConstraint,
  QueryLimitConstraint,
  QueryOrderByConstraint,
  QuerySnapshot,
  QueryStartAtConstraint,
  SnapshotMetadata,
  Timestamp,
  Transaction,
  WriteBatch,
  addDoc,
  aggregateFieldEqual,
  aggregateQuerySnapshotEqual,
  arrayRemove,
  arrayUnion,
  average,
  clearIndexedDbPersistence,
  collection,
  collectionGroup,
  count,
  deleteDoc,
  deleteField,
  deleteVector,
  denseVector,
  disableNetwork,
  doc,
  documentId,
  dualityViewCollection,
  dualityViewDoc,
  enableIndexedDbPersistence,
  enableMemoryPersistence,
  enableNetwork,
  enableOffline,
  endAt,
  endBefore,
  findNearest,
  getAggregateFromServer,
  getCountFromServer,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  getDocs,
  getDocsFromCache,
  getDocsFromServer,
  getOracledb,
  increment,
  initializeOracledb,
  join,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  query,
  queryEqual,
  refEqual,
  runTransaction,
  serverTimestamp,
  setDoc,
  snapshotEqual,
  sparseVector,
  startAfter,
  startAt,
  sum,
  updateDoc,
  updateDocs,
  waitForPendingWrites,
  where,
  writeBatch,
} from "../../oracledb/src/index.js";
export type {
  ListenOptions,
  OfflineOptions,
  PersistenceKind,
  PersistentLocalCacheOptions,
  ReadSource,
} from "../../oracledb/src/index.js";
