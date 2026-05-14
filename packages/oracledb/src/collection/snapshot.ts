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

import { DocumentSnapshot, QueryDocumentSnapshot } from "../document/snapshot.js";
import { SnapshotMetadata } from "../listener/snapshot.js";
import { DocumentChange, DocumentData } from "../types/common.js";
import { argCheck, oracledbErrorHandler } from "../util/utils.js";
import { typeStrings } from "../util/utils.js";

export class QuerySnapshot<AppModelType = DocumentData, DbModelType extends DocumentData = DocumentData> {
  /** @internal */  _docs: 	Array<QueryDocumentSnapshot<AppModelType, DbModelType>>;
  public readonly query: any; // Replace with your Query class if available
  public readonly metadata: SnapshotMetadata;

  constructor(snaps: Array<DocumentSnapshot<any, any>>, query: any, metadata: SnapshotMetadata) {
    this._docs = snaps as any;
    this.query = query;
    this.metadata = metadata;
  }

  /** Number of documents in the snapshot */
  get size(): number {
    return this._docs.length;
  }

  /** Array of documents in this snapshot */
  get docs(): Array<QueryDocumentSnapshot<AppModelType, DbModelType>> {
    return this._docs;
  }

  /** True if snapshot contains no documents */
  get empty(): boolean {
    return this._docs.length === 0;
  }

  /**
   * Iterates over each document in the snapshot.
   * @param callback - Function called for each document.
   */
  forEach(callback: (doc: DocumentSnapshot<AppModelType, DbModelType>) => void): void {
    argCheck(callback, "Invalid callback", true, [typeStrings.FUNCTION]);
    this._docs.forEach(callback);
  }

  docChanges(options?: any): Array<DocumentChange<AppModelType, DbModelType>> {
    const docsChanged:any = [];
    this.docs.forEach((doc, idx) => {
      docsChanged.push({
        doc: doc,
        type: "added",
        oldIndex: -1,
        newIndex: idx,
      });
    });
    return docsChanged;
  }

  isEqual(snap: QuerySnapshot<AppModelType, DbModelType>): boolean {
    if (!(snap instanceof QuerySnapshot)) {
      const error = new Error("The other instance to be compared should be an instance of QuerySnapshot") as Error & { status?: number };
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    if (!this.query.isEqual(snap.query)) {
      return false;
    }
    return JSON.stringify(snap.docs) === JSON.stringify(this.docs) &&
      JSON.stringify(snap.metadata) === JSON.stringify(this.metadata);
  }

  /** @internal */  _jsonObject(): object {
    const data = this.docChanges();
    const docChangesArr = data.map(dc => ({
      doc: JSON.parse(JSON.stringify(dc.doc)),
      type: dc.type,
      oldIndex: dc.oldIndex,
      newIndex: dc.newIndex
    }));
    const obj = JSON.parse(JSON.stringify(this));
    (obj as any)["docChanges"] = docChangesArr;
    return obj;
  }

  /**
   * @internal
   */
  static _parse(obj: any, ref: any, snaps: Array<DocumentSnapshot<any>>): QuerySnapshot<any> {
    const querySnap = new QuerySnapshot(snaps, ref, new SnapshotMetadata(obj.metadata.fromCache, obj.metadata.hasPendingWrites));
    return querySnap;
  }
}