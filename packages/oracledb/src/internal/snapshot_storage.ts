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
import { Oracledb } from "./core.js";
import { getErrorMessage } from "../errors.js";
import { IndexDBStore } from "./indexdb_storage.js";
import { QueryDocumentSnapshot } from "../document/snapshot.js";
import { DocumentSnapshot } from "../document/snapshot.js";
import { QuerySnapshot } from "../collection/snapshot.js";

/**
 * @internal
 */
class SnapshotStorage {
  /**
   * @internal
   */
  private oracledb: Oracledb;
  /**
   * @internal
   */
  private iDBStore: IndexDBStore;

  constructor(
    oracledb: Oracledb,
    name: string,
    objectStoreName: string,
    key: string
  ) {
    this.iDBStore = new IndexDBStore(name, objectStoreName, key);
    this.oracledb = oracledb;
  }

  /**
   * @internal
   */
  async get(id: string): Promise<any> {
    const oracleDB = this.oracledb;
    let result = await this.iDBStore.get(id);
    let ref: any = null;
    let snaps: QueryDocumentSnapshot[] = [];
    let docChanges: any[] = [];

    if (result.type === 'document') {
      const path = result.snap.ref._path.join('/');
      if (result.snap.ref.type === 'dualityviewdocument') {
        ref = oracleDB.dualityViewDoc(path);
      } else {
        ref = oracleDB.doc(path);
      }
      result.snap = DocumentSnapshot._parse(result.snap, ref);
    } else {
      for (let i = 0; i < result.snap._docs.length; i++) {
        const path = result.snap._docs[i].ref._path.join('/');
        if (result.snap._docs[i].ref.type === 'dualityviewdocument') {
          ref = oracleDB.dualityViewDoc(path);
        } else {
          ref = oracleDB.doc(path);
        }
        snaps.push(QueryDocumentSnapshot._parse(result.snap._docs[i], ref));
      }
      for (let i = 0; i < result.snap.docChanges.length; i++) {
        const path = result.snap.docChanges[i].doc.ref._path.join('/');
        if (result.snap.docChanges[i].doc.ref.type === 'dualityviewdocument') {
          ref = oracleDB.dualityViewDoc(path);
        } else {
          ref = oracleDB.doc(path);
        }
        result.snap.docChanges[i].doc = QueryDocumentSnapshot._parse(
          result.snap.docChanges[i].doc,
          ref
        );
        docChanges.push(result.snap.docChanges[i]);
      }
      const path = result.snap.query._path.join('/');
      if (result.snap.query.type === 'dualityviewcollection') {
        ref = oracleDB.dualityViewCollection(path);
      } else {
        ref = oracleDB.collection(path);
      }
      ref = ref.__copyQuery();
      ref._conditions = result.snap.query._conditions;
      ref._aggregate = result.snap.query._aggregate;
      ref._explicitOrder = result.snap.query._explicitOrder;
      ref._joins = result.snap.query._joins;
      ref._limit = result.snap.query._limit;
      ref._col_group = result.snap.query._col_group;
      result.snap = QuerySnapshot._parse(result.snap, ref, snaps);
      result.snap.docChanges = (_options: any) => docChanges;
    }
    return result;
  }

  /**
   * @internal
   */
  async set(obj: any): Promise<void> {
    if (
      obj == null ||
      obj['queryId'] == null ||
      obj['queryId'] === ''
    ) {
      throw new Error(getErrorMessage('cannotSetNullEntry'));
    }
    const preparedObj = { ...obj, snap: obj.snap._jsonObject() };
    await this.iDBStore.set(preparedObj);
  }

  async delete(id: string): Promise<void> {
    await this.iDBStore.delete(id);
  }

  async deleteDB(): Promise<void> {
    await this.iDBStore.deleteDB();
  }
}

export default SnapshotStorage;
