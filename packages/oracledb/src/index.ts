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

import { LogLevel } from "../../logger/LogLevel.js";
import { AggregateField, AggregateQuery, AggregateQuerySnapshot } from "./collection/aggregate.js";
import { QueryCompositeFilterConstraint, QueryConstraint, QueryEndAtConstraint, QueryFieldFilterConstraint, QueryFieldJoinsConstraint, QueryLimitConstraint, QueryOrderByConstraint, QueryStartAtConstraint } from "./collection/constraint.js";
import { Query } from "./collection/reference.js";
import { CollectionReference, DualityViewColReference } from "./collection/reference.js";
import { QuerySnapshot } from "./collection/snapshot.js";
import { DocumentReference, DualityViewDocReference } from "./document/reference.js";
import { DocumentSnapshot, QueryDocumentSnapshot } from "./document/snapshot.js";
import { FieldPath } from "./field/path.js";
import { FieldValue, Timestamp } from "./field/value.js";
import { Oracledb } from "./internal/core.js";
import { SnapshotMetadata } from "./listener/snapshot.js";
import { aggregateFieldEqual, aggregateQuerySnapshotEqual, average, count, sum } from "./public/aggregate.js";
import { collection, collectionGroup, dualityViewCollection, dualityViewDoc } from "./public/collection.js";
import { getOracledb, initializeOracledb } from "./public/core.js";
import { doc, documentId, refEqual } from "./public/document.js";
import { arrayRemove, arrayUnion, deleteField, increment, serverTimestamp } from "./public/fieldvalue.js";
import { getAggregateFromServer, getCountFromServer, getDoc, getDocFromServer, getDocs, getDocsFromServer } from "./public/get.js";
import { endAt, endBefore, join, limit, limitToLast, orderBy, query, queryEqual, startAfter, startAt, where } from "./public/query.js";
import { findNearest } from "./public/query.js";
import { deleteVector, denseVector, sparseVector } from "./public/vector.js";
import { snapshotEqual } from "./public/snapshot.js";
import { runTransaction, writeBatch } from "./public/transaction.js";
import { addDoc, deleteDoc, setDoc, updateDoc, updateDocs } from "./public/write.js";
import { onSnapshot } from "./public/snapshot.js";
import { Transaction, WriteBatch } from "./transaction/batch.js";
import { OracledbError, OracledbErrorCode } from "./util/utils.js";
import { setLogLevel } from "./util/utils_helper.js";


export {getDoc, onSnapshot, getDocFromServer, getDocsFromServer, getDocs, doc, getOracledb,
initializeOracledb, collection, dualityViewCollection, dualityViewDoc,
deleteDoc, setDoc, addDoc, updateDoc, runTransaction,
writeBatch, orderBy, where, join, limitToLast, limit, endAt, endBefore,
startAt, startAfter, query, getCountFromServer, count, sum, average,
getAggregateFromServer, aggregateFieldEqual, aggregateQuerySnapshotEqual, 
queryEqual, snapshotEqual, collectionGroup, refEqual, documentId, setLogLevel,
serverTimestamp, deleteField, arrayRemove, arrayUnion, increment, updateDocs,
denseVector, sparseVector, deleteVector, findNearest}

export {Timestamp};
export {QueryFieldJoinsConstraint};
export {FieldValue};
export {Oracledb};
export {DualityViewColReference};
export {DualityViewDocReference};
export {CollectionReference};
export {DocumentReference};
export {Query};
export {DocumentSnapshot};
export {WriteBatch};
export {QuerySnapshot};
export {FieldPath};
export {OracledbError};
export {AggregateField};
export {AggregateQuery};
export {AggregateQuerySnapshot};
export {Transaction};
export {QueryConstraint};
export {QueryCompositeFilterConstraint};
export {QueryEndAtConstraint};
export {QueryFieldFilterConstraint};
export {QueryLimitConstraint};
export {QueryOrderByConstraint};
export {QueryStartAtConstraint};
export {SnapshotMetadata};
export {QueryDocumentSnapshot};
export {OracledbErrorCode};
export {LogLevel};