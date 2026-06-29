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

import { DocumentReference, DualityViewDocReference } from "../document/reference.js";
import { createPayloadForUpdateVersion2New, extractEmbeddingsMapForCreate, parseTimestamp, serializeVersion2, setWholeData, updateNestedData } from "../util/utils_helper.js";
import { DocumentData, QueryType } from '../types/common.js';
import { OracledbDataConverter } from '../types/converter.js';
import { OracledbVersion, QueryHelper , Utils, argCheck, checkOracledbApiVersion, createUniqueName, getAccessToken, getToken, rearrangeBodyOfVersion2, snapHashcode, typeStrings ,} from '../util/utils.js';
import { FieldPath } from '../field/path.js';
import { oracledbErrorHandler } from '../util/utils.js';
import { DocumentSnapshot, QueryDocumentSnapshot } from '../document/snapshot.js';
import { AggregateQuery } from './aggregate.js';
import { deepEqual, extractCallbacksForSnapshot } from '../util/utils_helper.js';
import { nullCheck } from '../util/utils.js';
import { SnapshotMetadata } from '../listener/snapshot.js';
import { QuerySnapshot } from './snapshot.js';
import { IdTokenResult } from '../../../auth/src/types/idtoken.js';
import { VectorSearch } from '../types/vector.js';
import { normalizeLongPollingOptions } from '../internal/settings.js';

function getLongPollingIntervalMs(db: any): number {
  try {
    return normalizeLongPollingOptions(
      db._settings.experimentalLongPollingOptions
    ).timeoutSeconds * 1000;
  } catch (err) {
    throw oracledbErrorHandler(err);
  }
}

export class Query<AppModelType = DocumentData, DbModelType extends DocumentData = DocumentData> {
  /** @internal */ _conditions: any[] = [];
  /** @internal */ _explicitOrder: any[] = [];
  /** @internal */ _joins: any[] = [];
  /** @internal */ _aggregate: any[] = [];
  /** @internal */ _column: any[] = [];
  /** @internal */ _serverTimestamp:any[] = [];
  /** @internal */ _limit = 0;
  /** @internal */ __pk = "OID";
  /** @internal */ _path: any[] = [];
  /** @internal */ _col_group = "";
  /** @internal */ _queryHelper: any = null;
  /** @internal */ _brid: any[] = [];
  /** @internal */ _rt = 0;
  /**
   * @internal
   */
  public converter: OracledbDataConverter<any, any> | null;
  public type: QueryType;
  public oracledb: any;
  /** @internal */ _ops: any[] = [];
  /** @internal */ _vectorSearch?: VectorSearch;

  constructor(db: any) {
    this.type = "query";
    this.oracledb = db;
    this.converter = null;
    this._queryHelper = new QueryHelper(db.app);
    this._ops = [];
  }

  /**
   * @internal
   */
  addAggregate(obj:any) {
    this._aggregate.push(obj);
  }

  // Create a new query and copy current state
  /**
   * @internal
   */
  __copyQuery(): Query<AppModelType, DbModelType> {
  const newQuery = new Query<AppModelType, DbModelType>(this.oracledb);
  newQuery._path = [...this._path];
  newQuery._conditions = [...this._conditions];
  newQuery._serverTimestamp = [...this._serverTimestamp];
  newQuery._explicitOrder = this._explicitOrder.map(obj => ({ ...obj }));
  newQuery._joins = this._joins.map(obj => ({ ...obj }));
  newQuery._limit = this._limit;
  newQuery._aggregate = [...this._aggregate];
  newQuery._brid = [...this._brid];
  newQuery._column = [...this._column];
  newQuery._ops = [...this._ops];
  newQuery._col_group = this._col_group;
  newQuery._rt = this._rt;
  newQuery._vectorSearch = this._vectorSearch ? { ...this._vectorSearch } : undefined;
  newQuery.type = this.type;
  newQuery.converter = this.converter;
  return newQuery;
}


  // Converter logic
  withConverter<NewAppModelType extends DocumentData, NewDbModelType extends DocumentData = DocumentData>(
    converter: OracledbDataConverter<NewAppModelType, NewDbModelType> | null
  ): Query<NewAppModelType, NewDbModelType> {
    const newQuery = new Query<NewAppModelType, NewDbModelType>(this.oracledb);
    // Copy all state
    Object.assign(newQuery, this.__copyQuery());
    newQuery.converter = converter;
    return newQuery;
  }

  /**
   * @internal
   */
  isEqual(quer: Query<any, any>): boolean {
    if (!quer) return false;
    if (!(quer instanceof Query)) {
      let error = new Error("The other instance to be compared should be an instance of Query.");
      (error as any).status = 400;
      throw oracledbErrorHandler(error);
    }
    if (
      this._conditions.length !== quer._conditions.length ||
      this._explicitOrder.length !== quer._explicitOrder.length ||
      this._joins.length !== quer._joins.length ||
      this._aggregate.length !== quer._aggregate.length
    ) {
      return false;
    }
    for (let i = 0; i < this._conditions.length; i++) {
      if (
        this._conditions[i].field !== quer._conditions[i].field ||
        this._conditions[i].op !== quer._conditions[i].op ||
        this._conditions[i].value !== quer._conditions[i].value
      )
        return false;
    }
    for (let i = 0; i < this._serverTimestamp.length; i++) {
      if (this._serverTimestamp[i] !== quer._serverTimestamp[i]) {
        return false;
      }
    }

    for (let i = 0; i < this._brid.length; i++) {
      if (this._brid[i] !== quer._brid[i]) return false;
    }
    for (let i = 0; i < this._aggregate.length; i++) {
      if (
        this._aggregate[i].func !== quer._aggregate[i].func ||
        this._aggregate[i].field !== quer._aggregate[i].field ||
        this._aggregate[i].op_key !== quer._aggregate[i].op_key
      )
        return false;
    }
    for (let i = 0; i < this._explicitOrder.length; i++) {
      if (
        this._explicitOrder[i].field !== quer._explicitOrder[i].field ||
        this._explicitOrder[i].direction !== quer._explicitOrder[i].direction
      )
        return false;
    }
    if (!deepEqual(this._joins, quer._joins)) return false;
    for (let i = 0; i < this._path.length; i++) {
      if (this._path[i] !== quer._path[i]) return false;
    }
    if (!deepEqual(this._vectorSearch, quer._vectorSearch)) return false;
    return (
      this.__pk === quer.__pk &&
      this._limit === quer._limit &&
      this._col_group === quer._col_group &&
      this._rt === quer._rt
    );
  }

  /**
   * @internal
   */
  where(field: string | FieldPath, opStr: string, fieldValue: any): Query<AppModelType, DbModelType> {
    // if (this.type === "namedquery") {
    //   let error = new Error("Operation is not supported in namedQuery");
    //   (error as any).status = 400;
    //   throw oracledbErrorHandler(error);
    // }
    if (field instanceof FieldPath) field = field.fullPath;
    argCheck(field, "Invalid field provided", true, [typeStrings.STRING]);
    argCheck(opStr, "Invalid operation provided", true, [typeStrings.STRING]);
    if (opStr === "array-contains-any") {
      for (let op of this._ops)
        if (op === "array-contains") {
          let error = new Error("array-contains-any can't be used with array-contains.");
          (error as any).status = 400;
          throw oracledbErrorHandler(error);
        }
    }
    if (opStr === "array-contains") {
      for (let op of this._ops)
        if (op === "array-contains-any") {
          let error = new Error("array-contains-any can't be used with array-contains.");
          (error as any).status = 400;
          throw oracledbErrorHandler(error);
        }
    }
    this._ops.push(opStr);
    if (opStr !== "is-null") nullCheck(fieldValue, "Invalid value provided.");
    if (fieldValue == null && fieldValue == "") return this.__copyQuery();
    let operators = [
      "==", ">=", "<=", "<", ">", "in", "not-in", "like", "!=",
      "array-contains", "array-contains-any", "is-null"
    ];
    if (!operators.includes(opStr)) {
      let error = new Error("Incorrect comparison operator");
      (error as any).status = 400;
      throw oracledbErrorHandler(error);
    }
    opStr = opStr === "==" ? "=" : opStr;
    opStr = opStr === "is-null" ? "is NULL" : opStr;
    opStr = opStr === "not-in" ? "not in" : opStr;
    if ((opStr === "in" || opStr === "not in") && !Array.isArray(fieldValue)) {
      fieldValue = [fieldValue];
    }
    let _cond = {
      field: field,
      op: opStr,
      value: fieldValue,
    };
    let newQuery = this.__copyQuery();
    newQuery._conditions.push(_cond);
    return newQuery;
  }

  /**
   * @internal
   */
  startAt(...args: any[]): Query<AppModelType, DbModelType> {
    // if (this.type === "namedquery") {
    //   let error = new Error("Operation is not supported in namedQuery.");
    //   (error as any).status = 400;
    //   throw oracledbErrorHandler(error);
    // }
    let newQuery = this.__copyQuery();
    if (args[0] instanceof DocumentSnapshot) {
      let _cond = {
        field: newQuery._explicitOrder[0].field,
        op: ">=",
        value: args[0].get(newQuery._explicitOrder[0].field),
      };
      newQuery._conditions.push(_cond);
    } else {
      for (let i = 0; i < args.length; i++) {
        let _cond = {
          field: newQuery._explicitOrder[i].field,
          op: ">=",
          value: args[i],
        };
        newQuery._conditions.push(_cond);
      }
    }
    return newQuery;
  }

  /**
   * @internal
   */
  endAt(...args: any[]): Query<AppModelType, DbModelType> {
    // if (this.type === "namedquery") {
    //   let error = new Error("Operation is not supported in namedQuery.");
    //   (error as any).status = 400;
    //   throw oracledbErrorHandler(error);
    // }
    let newQuery = this.__copyQuery();
    if (args[0] instanceof DocumentSnapshot) {
      let _cond = {
        field: newQuery._explicitOrder[0].field,
        op: "<=",
        value: args[0].get(newQuery._explicitOrder[0].field),
      };
      newQuery._conditions.push(_cond);
    } else {
      for (let i = 0; i < args.length; i++) {
        let _cond = {
          field: newQuery._explicitOrder[i].field,
          op: "<=",
          value: args[i],
        };
        newQuery._conditions.push(_cond);
      }
    }
    return newQuery;
  }

  /**
   * @internal
   */
  startAfter(...args: any[]): Query<AppModelType, DbModelType> {
    // if (this.type === "namedquery") {
    //   let error = new Error("Operation is not supported in namedQuery.");
    //   (error as any).status = 400;
    //   throw oracledbErrorHandler(error);
    // }
    let newQuery = this.__copyQuery();
    if (args[0] instanceof DocumentSnapshot) {
      let _cond = {
        field: newQuery._explicitOrder[0].field,
        op: ">",
        value: args[0].get(newQuery._explicitOrder[0].field),
      };
      newQuery._conditions.push(_cond);
    } else {
      for (let i = 0; i < args.length; i++) {
        let _cond = {
          field: newQuery._explicitOrder[i].field,
          op: ">",
          value: args[i],
        };
        newQuery._conditions.push(_cond);
      }
    }
    return newQuery;
  }

  /**
   * @internal
   */
  endBefore(...args: any[]): Query<AppModelType, DbModelType> {
    // if (this.type === "namedquery") {
    //   let error = new Error("Operation is not supported in namedQuery.");
    //   (error as any).status = 400;
    //   throw oracledbErrorHandler(error);
    // }
    let newQuery = this.__copyQuery();
    if (args[0] instanceof DocumentSnapshot) {
      let _cond = {
        field: newQuery._explicitOrder[0].field,
        op: "<",
        value: args[0].get(newQuery._explicitOrder[0].field),
      };
      newQuery._conditions.push(_cond);
    } else {
      for (let i = 0; i < args.length; i++) {
        let _cond = {
          field: newQuery._explicitOrder[i].field,
          op: "<",
          value: args[i],
        };
        newQuery._conditions.push(_cond);
      }
    }
    return newQuery;
  }

  /**
   * @internal
   */
  limitToLast(limitValue: number): Query<AppModelType, DbModelType> {
    // if (this.type === "namedquery") {
    //   let error = new Error("Operation is not supported in namedQuery.");
    //   (error as any).status = 400;
    //   throw oracledbErrorHandler(error);
    // }
    argCheck(limitValue, "Invalid limit value passed", true, [typeStrings.INT]);
    let newQuery = this.__copyQuery();
    for (let i = 0; i < this._explicitOrder.length; i++) {
      newQuery._explicitOrder[i].direction =
        this._explicitOrder[i].direction === "asc" ? "desc" : "asc";
    }
    newQuery._limit = limitValue;
    return newQuery;
  }

  /**
   * @internal
   */
  orderBy(fieldName: string | FieldPath, dirStr: "asc" | "desc" = "asc"): Query<AppModelType, DbModelType> {
    // if (this.type === "namedquery") {
    //   let error = new Error("Operation is not supported in namedQuery.");
    //   (error as any).status = 400;
    //   throw oracledbErrorHandler(error);
    // }
    if (fieldName instanceof FieldPath) fieldName = fieldName.fullPath;
    argCheck(fieldName, "Invalid field name passed", true, [typeStrings.STRING]);
    argCheck(dirStr, "Invalid direction string passed", true, [typeStrings.STRING]);
    if (["asc", "desc"].indexOf(dirStr) === -1) {
      let error = new Error("Invalid direction.");
      (error as any).status = 400;
      throw oracledbErrorHandler(error);
    }
    let _order = { field: fieldName, direction: dirStr };
    let newQuery = this.__copyQuery();
    newQuery._explicitOrder.push(_order);
    return newQuery;
  }

  /**
   * @internal
   */
  limit(limitValue: number): Query<AppModelType, DbModelType> {
    // if (this.type === "namedquery") {
    //   let error = new Error("Operation is not supported in namedQuery.");
    //   (error as any).status = 400;
    //   throw oracledbErrorHandler(error);
    // }
    argCheck(limitValue, "Invalid limit value passed", true, [typeStrings.INT]);
    if (!(limitValue > 0)) {
      let error = new Error("Invalid limit provided.");
      (error as any).status = 400;
      throw oracledbErrorHandler(error);
    }
    let newQuery = this.__copyQuery();
    newQuery._limit = limitValue;
    return newQuery;
  }

  /**
   * @internal
   */
  join(viewName: string): Query<AppModelType, DbModelType> {
    // if (this.type === "namedquery") {
    //   let error = new Error("Operation is not supported in namedQuery.");
    //   (error as any).status = 400;
    //   throw oracledbErrorHandler(error);
    // }
    argCheck(viewName, "Invalid join view passed", true, [typeStrings.STRING]);
    let _join = { view_name: viewName };
    let newQuery = this.__copyQuery();
    newQuery._joins.push(_join);
    return newQuery;
  }

  /**
   * @internal
   */
  withVectorSearch(vectorSearch: VectorSearch): Query<AppModelType, DbModelType> {
    const newQuery = this.__copyQuery();
    newQuery._vectorSearch = vectorSearch;
    return newQuery;
  }

  /**
   * @internal
   */
  column(arr: string[]): Query<AppModelType, DbModelType> {
    argCheck(arr, "Invalid names passed", true, [typeStrings.ARRAY]);
    const newQuery = this.__copyQuery();
    newQuery._column = [...arr];
    return newQuery;
  }

  /**
   * @internal
   */
  count(): AggregateQuery<AppModelType, DbModelType> {
    // if (this.type === "namedquery") {
    //   let error = new Error("Operation is not supported in namedQuery.");
    //   (error as any).status = 400;
    //   throw oracledbErrorHandler(error);
    // }
    const agg_obj = { func: "count", field: "", op_key: "" };
    let newQuery = this.__copyQuery();
    return new AggregateQuery(newQuery, agg_obj);
  }

  /**
   * @internal
   */
  aggregate(obj: any): AggregateQuery<AppModelType, DbModelType> {
    // if (this.type === "namedquery") {
    //   let error = new Error("Operation is not supported in namedQuery.");
    //   (error as any).status = 400;
    //   throw oracledbErrorHandler(error);
    // }
    argCheck(obj, "Invalid aggregate object", true, [typeStrings.OBJECT]);
    const agg_obj: any[] = [];
    Object.entries(obj).map(([key, value]: [string, any]) => {
      agg_obj.push({
        func: value.aggregateType,
        field: value.field,
        op_key: key
      });
      return null;
    });
    let newQuery = this.__copyQuery();
    newQuery._aggregate = agg_obj;
    return new AggregateQuery(newQuery, null);
  }

  /**
   * Executes the query and returns the result in form of snapshot.
   */
  /**
   * @internal
   */
  async get(): Promise<QuerySnapshot<AppModelType, DbModelType>> {
    // if (this.type === "namedquery") {
    //   const qdata = await this.db.__getBundleData.get(this._path[0]);
    //   const qdocs: QueryDocumentSnapshot[] = [];

    //   for (let i = 0; i < qdata["documents"].length; i++) {
    //     const docRef = this.doc(qdata["documents"][i]["path"].substring(1));
    //     docRef.converter = this.converter;
    //     qdocs.push(
    //       new QueryDocumentSnapshot(
    //         { DOCUMENT: qdata["documents"][i]["data"] },
    //         docRef,
    //         new SnapshotMetadata(true, false)
    //       )
    //     );
    //   }

    //   return new QuerySnapshot(qdocs, this, new SnapshotMetadata(true, false));
    // }

    let promJson: any;
    const access_token = await getAccessToken(this.oracledb.app);

    try {
      promJson = await this._queryHelper.fetchDocuments(this, access_token);
    } catch (err) {
      Utils.baasTrace(this.oracledb.app.logLevel);
      return new QuerySnapshot([], this, new SnapshotMetadata(false, false));
    }

    if (promJson) {
      Utils.baasLogger(this.oracledb.app.logLevel, "Fetched DocSnaps!");
      const data = promJson.ret;
      const docSnaps: QueryDocumentSnapshot[] = [];

      const colCopy = new CollectionReference(
        this.oracledb,
        this._path.join("/")
      );
      colCopy.converter = this.converter;

      data.forEach((_doc:any) => {
        const doc = _doc.osons;
        const id = doc[this.__pk];
        if (_doc.brid) {
          doc["ROWID"] = _doc.brid;
        }

        const ref = new DocumentReference(this.oracledb, id, colCopy);
        ref.converter = this.converter;

        const meta = new SnapshotMetadata(false, false);
        docSnaps.push(new QueryDocumentSnapshot(doc, ref, meta));
      });

      return new QuerySnapshot(docSnaps, this, new SnapshotMetadata(false, false));
    }

    return new QuerySnapshot([], this, new SnapshotMetadata(false, false));
  }

  private updateListenersCount(x: number): void {
    let total_listeners_init =
      window.localStorage.getItem(this.oracledb.__listenerKey);
    if (total_listeners_init == null) {
      total_listeners_init = "0";
    }
    if (this.oracledb.__listening === 0) {
      window.localStorage.setItem(
        this.oracledb.__listenerKey,
        (parseInt(total_listeners_init) + x).toString()
      );
      this.oracledb.__listening = x;
    }
  }

  /**
   * Attaches callback to be executed on QuerySnapshot events.
   */
  /**
   * @internal
   */
  onSnapshot(...args: any[]): () => void {
    // if (this.type === "namedquery") {
    //   throw oracledbErrorHandler(new OracledbError("Operation is not supported in namedQuery.", 400));
    // }

    this._rt = 1;
    this.updateListenersCount(1);

    let callback = extractCallbacksForSnapshot(...args);
    const handleSnapshot = (querySnap: QuerySnapshot) => {
      if (callback.next) {
        try {
          callback.next(querySnap);
        } catch (ue) {
          Utils.baasLogger(this.oracledb.app.logLevel, "Error in snapshot callback", ue);
        }
      }
    };
    let tok =  getToken(this.oracledb.app);
    if (tok) {
      tok = new IdTokenResult(tok);
    }
    const access_token = tok;
    const _queryId = createUniqueName();

    const payload = {
      path: this._path,
      conditions: this._conditions,
      explicitOrder: this._explicitOrder,
      joins: this._joins,
      access_token: access_token ? access_token.claims.sub : null
    };

    

    const mappedQueryId = Math.abs(snapHashcode(JSON.stringify(payload)));
    delete (payload as any)["access_token"];
    const queryId = Math.abs(snapHashcode(JSON.stringify(payload)));

    let unsubscribe: () => void;

    // Non-long-polling case
    if (
      !this.oracledb._settings.experimentalAutoDetectLongPolling &&
      !this.oracledb._settings.experimentalForceLongPolling
    ) {
      this.oracledb.__createSocket(access_token ? access_token.token : null);

      const queryObject = {
        queryId,
        status: 1,
        payload,
        TABLE_NAME: ""
      };

      if (!Utils.memberExists(this.oracledb.__snaps, queryId)) {
        this.oracledb.__snaps[queryId] = [];
        Utils.baasLogger(this.oracledb.app.logLevel, "__sendMessage", queryObject);
        this.oracledb.__sendMessage(queryObject);
      }

      this.oracledb.__snaps[queryId].push(_queryId);
      this.oracledb.__callbacks[_queryId] = callback;
      this.oracledb.__queryIdMap[queryId] = mappedQueryId;

      this.get()
        .then((querySnap) => {
          querySnap.docChanges = () =>
            querySnap.docs.map((doc, i) => ({
              doc,
              type: "added",
              oldIndex: -1,
              newIndex: i
            }));

          handleSnapshot(querySnap as any);

          this.oracledb.__setIndexDB({
            queryId: mappedQueryId,
            snap: querySnap,
            type: "collection",
            path: this._path.join("/")
          }).catch((e: any) => Utils.baasLogger(this.oracledb.app.logLevel, e));
        })
        .catch((e: any) => {
          if (callback.error) {
            try {
              callback.error(e);
            } catch (ue) {
              Utils.baasLogger(this.oracledb.app.logLevel, "Error in snapshot callback", ue);
            }
          }
        });

      unsubscribe = () => {
        Utils.baasLogger(this.oracledb.app.logLevel, "in unsubscribe", _queryId);

        const activeListeners = this.oracledb.__snaps[queryId];
        if (activeListeners) {
          const index = activeListeners.indexOf(_queryId);
          if (index > -1) {
            activeListeners.splice(index, 1);
            delete this.oracledb.__callbacks[_queryId];
          }

          if (activeListeners.length === 0) {
            delete this.oracledb.__queryIdMap[queryId];
            delete this.oracledb.__snaps[queryId];
            this.oracledb.__sendMessage({ queryId, status: 0, payload });
          }
        }

        if (callback.error) {
          callback.error(new Error("Unsubscribe called!"));
        }

        callback = { next: null, complete: null, error: null };
      };
    } else {
      let oldQuerySnap:any;
      //for the first time 
      this.get().then((querySnap:any) => {
        //docChanges
        querySnap.docChanges = (options:any) => {
          let docsChanged:any = [];
          querySnap.docs.forEach((doc:any) => {
            let docChange = {
              doc: doc,
              type: "added",
              oldIndex: -1,
              newIndex: docsChanged.length,
            };
            docsChanged.push(docChange);
          });
          return docsChanged;
        };
        handleSnapshot(querySnap);
        oldQuerySnap = querySnap;

      })
        .catch(e => {
          var querySnap = new QuerySnapshot([], this,
            new SnapshotMetadata(false, false));
          handleSnapshot(querySnap);
        });

      const db = this.oracledb;
      const colRef = this;
      const pollingIntervalMs = getLongPollingIntervalMs(db);

      //polling
      function startPolling() {
        // Function to be executed
        function executeTask() {
          colRef.get().then((querySnap:any) => {
            //get last snapshot
              if (oldQuerySnap == null) {
                throw new Error("Could not locate last snapshot in indexed db");
              }

              //create version maps for old and new snapshot docs
              let oldVersionMap:any = {};
              let newVersionMap:any = {};

              let newDocs:any = [];

              //index map for old documents
              let oldIndexMap:any = {};
          
              for (let i = 0; i < querySnap._docs.length; i++) {
                newVersionMap[querySnap._docs[i].id] = querySnap._docs[i]._otherMetadata["ASOF"] ?
                 BigInt(querySnap._docs[i]._otherMetadata["ASOF"]) : querySnap._docs[i]._otherMetadata["VERSION"];
              }
              for (let i = 0; i < oldQuerySnap._docs.length; i++) {
                oldVersionMap[oldQuerySnap._docs[i].id] = oldQuerySnap._docs[i]._otherMetadata["ASOF"] ?
                BigInt(oldQuerySnap._docs[i]._otherMetadata["ASOF"]) : oldQuerySnap._docs[i]._otherMetadata["VERSION"];
                oldIndexMap[oldQuerySnap._docs[i].id] = i;
              }

              //create doc changes
              let docsChanged = [];
              for (let i = 0; i < querySnap._docs.length; i++) {
                if (Object.prototype.hasOwnProperty.call(oldVersionMap,
                  querySnap._docs[i].id) && newVersionMap[querySnap._docs[i].id] >
                  oldVersionMap[querySnap._docs[i].id]) {
                  docsChanged.push({
                    doc: querySnap._docs[i],
                    type: "modified",
                    oldIndex: oldIndexMap[querySnap._docs[i].id],
                    newIndex: newDocs.length
                  });
                  newDocs.push(querySnap._docs[i]);
                } else if (!Object.prototype.hasOwnProperty.call(oldVersionMap,
                  querySnap._docs[i].id)) {
                  docsChanged.push({
                    doc: querySnap._docs[i],
                    type: "added",
                    oldIndex: -1,
                    newIndex: newDocs.length,
                  });
                  newDocs.push(querySnap._docs[i]);
                } else {
                  newDocs.push(querySnap._docs[i]);
                }
              }
              
              for (let i = 0; i < oldQuerySnap._docs.length; i++) {
                if (!Object.prototype.hasOwnProperty.call(newVersionMap,
                  oldQuerySnap._docs[i].id)) {
                  docsChanged.push({
                    doc: oldQuerySnap._docs[i],
                    type: "removed",
                    oldIndex: i,
                    newIndex: -1,
                  });
                }
              }

              querySnap._docs = newDocs;

              querySnap.docChanges = (options:any) => {
                return docsChanged;
              };

              if (docsChanged.length > 0) {
                handleSnapshot(querySnap);
              }

              oldQuerySnap = querySnap

          }).catch(e => { Utils.baasLogger(db.app.logLevel, e) })
        }

        let intervalId = setInterval(executeTask, pollingIntervalMs);

        // Return a function to stop the continuous execution
        return function stopExecution() {
          clearInterval(intervalId); // Stops the continuous execution
          Utils.baasLogger(db.app.logLevel, "Continuous execution stopped.");
        };
      }

      // Usage
      let stopPolling = startPolling();

      unsubscribe = () => {
        Utils.baasLogger(db.app.logLevel, "in unsubscribe", _queryId);
        stopPolling();

        if (callback.error != null) {
          try {
            callback.error(new Error("Unsubscribe called!"));
          } catch (ue) {
            Utils.baasLogger(db.app.logLevel, "Error in snapshot callback ", ue);
          }
        }
        callback = {
          next: null,
          complete: null,
          error: null
        }
      }
    }

    return () => unsubscribe();
  }

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

export class CollectionReference<
  AppModelType = DocumentData,
  DbModelType extends DocumentData = DocumentData
> extends Query<AppModelType, DbModelType> {
  public readonly id: string;
  public readonly parent: DocumentReference<DocumentData, DocumentData> | null;
  public readonly type: QueryType = 'collection';

  constructor(
    db: any,
    path: string,
    parent: DocumentReference<DocumentData, DocumentData> | null = null
  ) 
  {
    super(db);
    if (path == null) {
      let error = new Error("Path cannot be empty for a collection!");
      (error as any).status = 400;
      throw oracledbErrorHandler(error);
    }
    path = path.toString().trim();
    let tokens = path.split('/');
    if ((parent == null && tokens.length % 2 === 0) ||
        (parent && tokens.length % 2 !== 0)) {
      const error = new Error("Incorrect path for Collection");
      (error as any).status = 400;
      throw oracledbErrorHandler(error);
    }
    this.id = tokens.pop()!;
    this.parent = (tokens.length === 0) ? parent
      : new DocumentReference(db, tokens.join("/"), parent as any);
    this._path = this.parent ? [...this.parent._path, this.id] : [this.id];
  }

  /**
   * The full path of this collection relative to the root of the database.
   */
  get path(): string {
    return this._path.join('/');
  }

  /**
   * Returns a DocumentReference for the document in the collection for the path.
   */
  /**
   * @internal
   */
  doc<DocAppModelType = AppModelType, DocDbModelType extends DocumentData = DbModelType>(
    docPath: string
  ): DocumentReference<DocAppModelType, DocDbModelType> {
    argCheck(docPath, "Invalid document path", false, [typeStrings.STRING]);
    const newDoc = new DocumentReference<DocAppModelType, DocDbModelType>(this.oracledb, docPath, this);
    newDoc.converter = this.converter as any;
    return newDoc;
  }

  /**
   * Adds a new document to this collection.
   */
  // async add(document: any): Promise<DocumentReference<AppModelType, DbModelType>> {
  //   if (isInstanceOfAnyClass(document) && this.converter != null) {
  //     document = this.converter.toOracledb(document);
  //   }
  //   argCheck(document, "Invalid data", true, [typeStrings.OBJECT]);
  //   let createdDocId = 'newly-created-id'; 
  //   const newDoc = new DocumentReference<AppModelType, DbModelType>(this.oracledb, createdDocId, this);
  //   newDoc.converter = this.converter;
  //   return newDoc;
  // }

  /**
   * @internal
   */
  async add(dataObj: any): Promise<DocumentReference<AppModelType, DbModelType>> {
    // Convert if instance of a class and converter exists
    if (this.converter != null) {
        dataObj = this.converter.toOracledb(dataObj);
    }

    // Argument validation
    argCheck(dataObj, "Invalid data", true, [typeStrings.OBJECT]);

    let promJson: any;
    let data: Record<string, any>;
    let document: Record<string, any> = {};

    data = setWholeData(this, {}, dataObj, true);
    if (checkOracledbApiVersion(this.oracledb.app.options, OracledbVersion.VER_2)) {
      const embeddings = extractEmbeddingsMapForCreate(data);
      if (Object.keys(embeddings).length > 0) {
        data = Object.fromEntries(
          Object.entries(data).filter(([k]) => !Object.prototype.hasOwnProperty.call(embeddings, k))
        );
        data["$embeddings"] = embeddings;
      }
    }
    document = parseTimestamp(data);

    // Get access token
    const accessToken = await getAccessToken(this.oracledb.app);

    try {
        // Create document
        promJson = await this._queryHelper.createDocument(this, document, accessToken);

        // Check if OID is returned
        if (!promJson) {
            const error = new Error("DocID not returned!") as Error & { status?: number };
            error.status = 404;
            throw error;
        }

        Utils.baasLogger(this.oracledb.app.logLevel, "Received OID");

        // Return new DocumentReference
        const newDoc = new DocumentReference<AppModelType, DbModelType>(this.oracledb, promJson["OID"], this);
        newDoc.converter = this.converter;
        return newDoc;

    } catch (err: any) {
        Utils.baasTrace(this.oracledb.app.logLevel);
        throw oracledbErrorHandler(err);
    }
}


  /**
   * Checks if this CollectionReference is equal to another CollectionReference.
   */
  /**
   * @internal
   */
  isEqual(
    other: CollectionReference<any, any>
  ): boolean {
    if (!(other instanceof CollectionReference)) {
      let error = new Error("The other instance to be compared should be an instance of CollectionReference");
      (error as any).status = 400;
      throw oracledbErrorHandler(error);
    }
    return this.id === other.id && this.path === other.path;
  }
}

export class DualityViewColReference<
  AppModelType = DocumentData,
  DbModelType extends DocumentData = DocumentData
> extends Query<AppModelType, DbModelType> {
  id: string;
  parent: null;
  /** @internal */  _path: string[];
  /** @internal */ _serverTimestamp:any[] = [];

  // Ensure _queryHelper exists; Query stub supplies one
  constructor(db: any, name: string) {
    super(db);
    this.type = 'dualityviewcollection';

    if (name == null) {
      const error: any = new Error('View name cannot be empty for a duality view collection!');
      error.status = 400;
      throw oracledbErrorHandler(error);
    }

    name = name.toString().trim();
    this.id = name;
    this.parent = null;
    this._path = name.split('/');

    if (this._path.length > 1) {
      const error: any = new Error('Incorrect path for DualityView');
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
  }

  get path(): string {
    return this._path.join('/');
  }

  /**
   * @internal
   */
  doc<DocAppModelType = AppModelType, DocDbModelType extends DocumentData = DbModelType>(docPath: string): DualityViewDocReference<DocAppModelType, DocDbModelType> {
    argCheck(docPath, 'Invalid document path', false, [typeStrings.STRING]);
    const newDoc = new DualityViewDocReference<DocAppModelType, DocDbModelType>(this.oracledb, docPath, this);
    newDoc.converter = this.converter;
    return newDoc;
  }

  /**
   * @internal
   */
  async add<T extends Record<string, any>>(data_obj: T): Promise<DualityViewDocReference<AppModelType, DbModelType>> {
    if (this.converter != null) {
      data_obj = this.converter.toOracledb(data_obj);
    }
    argCheck(data_obj, 'Invalid data', true, [typeStrings.OBJECT]);

    let data: any;
    let document: any;

    data = setWholeData(this, {}, data_obj, true);
    if (checkOracledbApiVersion(this.oracledb.app.options, OracledbVersion.VER_2)) {
      const embeddings = extractEmbeddingsMapForCreate(data);
      if (Object.keys(embeddings).length > 0) {
        data = Object.fromEntries(
          Object.entries(data).filter(([k]) => !Object.prototype.hasOwnProperty.call(embeddings, k))
        );
        data["$embeddings"] = embeddings;
      }
    }
    document = parseTimestamp(data);

    const access_token = await getAccessToken(this.oracledb.app);

    try {
      const promJson = await this._queryHelper!.createDocument(this, document, access_token);

      if (!promJson) {
        const error: any = new Error('DocID not returned!');
        error.status = 404;
        throw error;
      }

      Utils.baasLogger(this.oracledb.app.logLevel, 'Received OID');
      const newDoc = new DualityViewDocReference<AppModelType, DbModelType>(this.oracledb, promJson['OID'], this);
      newDoc.converter = this.converter;
      return newDoc;
    } catch (err) {
      Utils.baasTrace(this.oracledb.app.logLevel);
      throw oracledbErrorHandler(err);
    }
  }

  /**
   * @internal
   */
  async get(): Promise<QuerySnapshot<AppModelType, DbModelType>> {
    let promJson: any;
    const access_token = await getAccessToken(this.oracledb.app);

    try {
      promJson = await this._queryHelper!.fetchDocuments(this, access_token);
    } catch (err) {
      Utils.baasTrace(this.oracledb.app.logLevel);
      const q_meta = new SnapshotMetadata(false, false);
      return new QuerySnapshot([], this, q_meta);
    }

    if (promJson) {
      Utils.baasLogger(this.oracledb.app.logLevel, 'Fetched DocSnaps!');
      const data: any[] = promJson['ret'] || [];
      const docSnaps: QueryDocumentSnapshot[] = [];
      const colCopy = new DualityViewColReference(this.oracledb, this._path.join('/'));
      colCopy.converter = this.converter;

      data.forEach((_doc: any) => {
        const doc = _doc['osons'];
        const id = doc[this.__pk];
        const _meta = new SnapshotMetadata(false, false);
        if (_doc['brid']) {
          doc['ROWID'] = _doc['brid'];
        }
        const ref = new DualityViewDocReference(this.oracledb, id, colCopy);
        ref.converter = this.converter;
        const docSnap = new QueryDocumentSnapshot(doc, ref, _meta);
        docSnaps.push(docSnap);
      });

      const q_meta = new SnapshotMetadata(false, false);
      const qSnap = new QuerySnapshot(docSnaps, this, q_meta);
      return qSnap as any;
    }

    const q_meta = new SnapshotMetadata(false, false);
    return new QuerySnapshot([], this, q_meta);
  }

  isEqual(ref: any): boolean {
    if (!(ref instanceof DualityViewColReference)) {
      const error: any = new Error(
        'The other instance to be compared should be an       instance of DualityViewColReference'
      );
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    return this.id === ref.id && this.path === ref.path;
  }
}




