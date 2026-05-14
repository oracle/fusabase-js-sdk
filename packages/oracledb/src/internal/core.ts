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

import { DBConn, getHostString, getSnapshotToken, nullCheck } from "../util/utils.js";
import { App } from "../../../app/src/public-types.js";
import SnapshotStorage from "./snapshot_storage.js";
import { Utils } from "../util/utils.js";
import { argCheck } from "../util/utils.js";
import { CollectionReference, DualityViewColReference } from "../collection/reference.js";
import { typeStrings } from "../util/utils.js";
import { DocumentReference, DualityViewDocReference } from "../document/reference.js";
import { Transaction } from "../transaction/batch.js";
import { createUniqueName } from "../util/utils.js";
import { WriteBatch } from "../transaction/batch.js";
import { oracledbErrorHandler } from "../util/utils.js";
import { Query } from "../collection/reference.js";
import { createConnection } from "../util/utils_helper.js";
import { LogLevel } from "../../../logger/LogLevel.js";
import { DocumentSnapshot, QueryDocumentSnapshot } from "../document/snapshot.js";
import { SnapshotMetadata } from "../listener/snapshot.js";
import { QuerySnapshot } from "../collection/snapshot.js";
import { DocumentData } from "../types/common.js";
import { BulkUpdate } from "../transaction/bulk.js";

export class Oracledb {
  #conn: DBConn | null = null;
  #snapStore: SnapshotStorage | undefined;
  connection: WebSocket | null = null;
  #bundleStore: any;
  private eventManager: EventTarget | undefined;
  name: string | undefined;
  /** @internal */  __snaps: Record<string, any> = {};
  /** @internal */  __callbacks: Record<string, any> = {};
  /** @internal */  __listening: number = 0;
  /** @internal */  __messageQueue: any[] = [];
  /** @internal */  __queryIdMap: Record<string, any> = {};

  /** @internal */  __listenerKey: string;
  app: App;
  type: string;
  /** @internal */  _settings: any;

  constructor(app: App) {
    this.__listenerKey = "__fusabaseindexeddb__";
    this.app = app;
    this.type = "oracledb";
    let socketURL = app.options.ordsHost ?? '';
    let cert = socketURL.split("://")[0];
    let useSSL = cert !== "http";
    socketURL = socketURL.split("://")[1];
    let schemaName = socketURL.split("ords")[1];
    socketURL = socketURL.split("ords")[0];
    socketURL = socketURL + "ords/baas-realtime" + schemaName;
    this._settings = {
      experimentalAutoDetectLongPolling: !app.options.useSocket,
      experimentalForceLongPolling: !app.options.useSocket,
      host: socketURL,
      ssl: useSSL,
      merge: false,
      ignoreUndefinedProperties: true,
      experimentalLongPollingOptions: { timeoutSeconds: app.options.longPollingInterval }
    };
    this.#conn = new DBConn(app);
    this.#snapStore = new SnapshotStorage(this, app.options.appID + "FUSABASE_SNAP_DB1", "SNAPS", "queryId");
    this.#bundleStore = null;
    this.eventManager = new EventTarget();
    if (this.eventManager.addEventListener != null) {
      this.eventManager.addEventListener("socket established", (e: Event) => {
        e.preventDefault?.();
        for (let i = 0; i < this.__messageQueue.length; i++) {
          Utils.baasLogger(this.app.logLevel, "sending message from queue", this.__messageQueue[i]);
          this.connection!.send(this.__messageQueue[i]);
        }
      });
    }
    const __cleanDB = () => {
      Utils.baasLogger(this.app.logLevel, "cleaning db");
      this.connection = null;
      this.__snaps = {};
      if (this.#snapStore != null) {
        this.#snapStore.deleteDB();
      }
    };
    if (typeof window !== "undefined") {
      const listenerKey = this.__listenerKey;
      const listening = this;
      window.addEventListener('beforeunload', function (e) {
        e.preventDefault?.();
        let total_listeners:any = window.localStorage.getItem(listenerKey);
        if (total_listeners != null && listening.__listening === 1) {
          //Utils.baasLogger((listening.app as any).logLevel, "reduce");
          total_listeners = parseInt(total_listeners);
          window.localStorage.setItem(listenerKey,
            Math.max(total_listeners - 1, 0).toString());
          if (total_listeners <= 1) {
            __cleanDB();
          }
        }
        (e as any).returnValue = '';
      });
    }
  }

  /**
   * @internal
   */
  settings(obj: any) {
    argCheck(obj, "Invalid argument passed", true, [typeStrings.OBJECT]);
    this._settings = {
      experimentalAutoDetectLongPolling: obj.experimentalAutoDetectLongPolling ?? this._settings.experimentalAutoDetectLongPolling,
      experimentalForceLongPolling: obj.experimentalForceLongPolling ?? this._settings.experimentalForceLongPolling,
      host: obj.host ?? this._settings.host,
      ssl: obj.ssl ?? this._settings.ssl,
      merge: obj.merge ?? this._settings.merge,
      ignoreUndefinedProperties: obj.ignoreUndefinedProperties ?? this._settings.ignoreUndefinedProperties,
      experimentalLongPollingOptions: obj.experimentalLongPollingOptions ?? this._settings.experimentalLongPollingOptions
    };
  }

  /**
   * @internal
   */
  __getBundleData(id: string): Promise<any> {
    Utils.baasLogger(this.app.logLevel, "retrieving bundle data", id);
    return this.#bundleStore!.get(id);
  }

  /**
   * @internal
   */
  __setBundleData(obj: object): void {
    Utils.baasLogger(this.app.logLevel, "setting bundle data", obj);
    this.#bundleStore!.set(obj);
  }

  /**
   * @internal
   */
  __retrieveSnaps(id: string): Promise<any> {
    return this.#snapStore!.get(id);
  }

  /**
   * @internal
   */
  __setIndexDB(object: object): Promise<any> {
    Utils.baasLogger(this.app.logLevel, "index db set", object);
    return this.#snapStore!.set(object);
  }

  /**
   * @internal
   */
  __removeIndexDB(id: string): Promise<any> {
    return this.#snapStore!.delete(id);
  }

  /**
   * @internal
   */
  __sendMessage(payload: object): void {
    const strPayload = JSON.stringify(payload);
    if (!this.connection || this.connection.readyState !== 1) {
      Utils.baasLogger(this.app.logLevel, "adding to message queue");
      this.__messageQueue.push(strPayload);
    } else {
      Utils.baasLogger(this.app.logLevel, "sending directly");
      this.connection.send(strPayload);
    }
  }

  // Socket establishment logic
  /**
   * @internal
   */
  private async __createSocket(token: string): Promise<void> {
  if (this.connection != null && this.connection.readyState !== WebSocket.CLOSED) {
    return;
  }

  const snapToken = await getSnapshotToken(
    this.app,
    `${this.app.options.ordsHost}_/baas-services/idm/onprem/${this.app.options.projectID}/authorizeSnapshot?apiKey=${this.app.options.appID}`,
    token
  );

  this.connection = createConnection(
    getHostString(this._settings.ssl, this._settings.host, snapToken["access_token"])
  );

  const __fireEvent = (event: Event) => {
    this.eventManager?.dispatchEvent(event);
  };

  this.connection.onopen = (event: Event) => {
    event.preventDefault();
    __fireEvent(new Event("socket established"));
  };

  this.connection.onerror = (error: Event) => {
    alert(`[error]`);
  };

  const oracleDB = this;

  this.connection.onmessage = async (event: MessageEvent) => {
    event.preventDefault();
    Utils.baasLogger(oracleDB.app.logLevel, "event received!", event.data);

    let eventData: any;
    try {
      eventData = JSON.parse(event.data);
    } catch (e) {
      return;
    }

    if (
      !Object.prototype.hasOwnProperty.call(eventData, "queryId") ||
      !Object.prototype.hasOwnProperty.call(eventData, "rowId")
    ) {
      return;
    }

    const queryId = eventData.queryId;
    const rowId = eventData.rowId;
    let changedData = eventData.changedData;
    let oid = eventData.changedData?.OID;
    const opr: string[] = eventData.operations;
    delete changedData?.["OID"];

    if (!Object.prototype.hasOwnProperty.call(oracleDB.__snaps, queryId)) {
      return;
    }

    const mappedQueryId = oracleDB.__queryIdMap[queryId];

    try {
      const resObj = await oracleDB.__retrieveSnaps(mappedQueryId);
      Utils.baasLogger(oracleDB.app.logLevel, "resObj from retrieve", resObj);

      if (resObj == null) return;

      // ---------- Document Snapshot Handling ----------
      if (resObj.type === "document") {
        Utils.baasLogger(oracleDB.app.logLevel, "document level run");

        let docR: any;
        if (resObj.snap.ref.type === "dualityviewdocument") {
          docR = oracleDB.dualityViewDoc(resObj.path);
        } else {
          docR = oracleDB.doc(resObj.path);
        }

        if (opr[opr.length - 1] === "DELETE") {
          changedData = resObj.snap._data;;
        }

        let ver: string | null = null;
        let asof: string | null = null;
        let lastmod: string | null = null;

        if (changedData && changedData["_metadata"]) {
          ver = changedData["_metadata"]["etag"];
          asof = changedData["_metadata"]["asof"];
          delete changedData["_metadata"];
        }

        if (changedData && changedData["VERSION"]) {
          ver = changedData["VERSION"];
          delete changedData["VERSION"];
        }

        if (changedData && changedData["LAST_MODIFIED"]) {
          lastmod = changedData["LAST_MODIFIED"];
          delete changedData["LAST_MODIFIED"];
        }

        const docData = {
          DOCUMENT: changedData,
          LAST_MODIFIED: lastmod,
          CREATED: null,
          SUBCOLLECTION: null,
          ASOF: asof,
          PARENT_OID: null,
          VERSION: ver,
          ROWID: rowId
        };

        const docSnap = new DocumentSnapshot(
          docData,
          docR,
          new SnapshotMetadata(false, false)
        );
        resObj.snap = docSnap;

        for (const _queryId of oracleDB.__snaps[queryId]) {
          const callback = oracleDB.__callbacks[_queryId];
          if (callback) {
            try {
              callback.next(docSnap);
            } catch (ue) {
              Utils.baasLogger(oracleDB.app.logLevel, "Error running callbacks ", ue);
            }
          }
        }

        await oracleDB.__setIndexDB(resObj)
          .then(() => Utils.baasLogger(oracleDB.app.logLevel, "document set successful for onmessage"))
          .catch((e: any) => Utils.baasLogger(oracleDB.app.logLevel, e));

        // ---------- Query Snapshot Handling ----------
      } else {
        Utils.baasLogger(oracleDB.app.logLevel, "query level run");

        let query: any;
        let ref: any = null;
        const oldSnap = resObj.snap;

        if (opr[opr.length - 1] === "DELETE") {
          changedData = null;
          if (!oid) {
            for (const doc of oldSnap._docs) {
              if (doc.__rowId === rowId) {
                oid = doc.id;
                changedData = doc._data;
                break;
              }
            }
          }
        }

        if (resObj.snap.query.type === "dualityviewcollection") {
          query = oracleDB.dualityViewCollection(resObj.path);
          ref = query.dualityViewDoc(oid);
        } else {
          query = oracleDB.collection(resObj.path);
          ref = query.doc(oid);
        }

        let ver: string | null = null;
        let asof: string | null = null;
        let lastmod: string | null = null;

        if (changedData && changedData["_metadata"]) {
          ver = changedData["_metadata"]["etag"];
          asof = changedData["_metadata"]["asof"];
          delete changedData["_metadata"];
        }

        if (changedData && changedData["VERSION"]) {
          ver = changedData["VERSION"];
          delete changedData["VERSION"];
        }

        if (changedData && changedData["LAST_MODIFIED"]) {
          lastmod = changedData["LAST_MODIFIED"];
          delete changedData["LAST_MODIFIED"];
        }

        const docData = {
          DOCUMENT: changedData,
          LAST_MODIFIED: lastmod,
          CREATED: null,
          SUBCOLLECTION: null,
          ASOF: asof,
          PARENT_OID: null,
          VERSION: ver,
          ROWID: rowId
        };

        const docSnap = new QueryDocumentSnapshot(
          docData,
          ref,
          new SnapshotMetadata(false, false)
        );

        const docSnaps = oldSnap._docs;
        const indexMap: Record<string, number> = {};
        for (let i = 0; i < docSnaps.length; i++) {
          indexMap[docSnaps[i].id] = i;
        }

        const docChange: any[] = [];

        for (let i = opr.length - 1; i >= 0; i--) {
          if (opr[i] === "INSERT") {
            docSnaps.push(docSnap);
            docChange.push({
              doc: docSnap,
              type: "added",
              oldIndex: -1,
              newIndex: docSnaps.length - 1
            });
          } else if (opr[i] === "UPDATE") {
            docSnaps[indexMap[oid]] = docSnap;
            docChange.push({
              doc: docSnap,
              type: "modified",
              oldIndex: indexMap[oid],
              newIndex: indexMap[oid]
            });
          } else if (opr[i] === "DELETE") {
            docSnaps.splice(indexMap[oid], 1);
            docChange.push({
              doc: docSnap,
              type: "removed",
              oldIndex: indexMap[oid],
              newIndex: -1
            });
          }
          break;
        }

        const querSnap = new QuerySnapshot(
          docSnaps,
          query,
          new SnapshotMetadata(false, false)
        );
        querSnap._docs = docSnaps;

        querSnap.docChanges = (options?: any) => docChange;
        resObj.snap = querSnap;

        for (const _queryId of oracleDB.__snaps[queryId]) {
          const callback = oracleDB.__callbacks[_queryId];
          if (callback) {
            try {
              callback.next(resObj.snap);
            } catch (ue) {
              Utils.baasLogger(oracleDB.app.logLevel, "Error running callbacks ", ue);
            }
          }
        }

        Utils.baasLogger(oracleDB.app.logLevel, "query set on message", resObj);

        await oracleDB.__setIndexDB(resObj)
          .then(() => Utils.baasLogger(oracleDB.app.logLevel, "query set successful for onmessage"))
          .catch((e: any) => Utils.baasLogger(oracleDB.app.logLevel, e));
      }
    } catch (e) {
      Utils.baasLogger(oracleDB.app.logLevel, e);
    }
  };
}

  /**
   * @internal
   */
  get url(): string {
    return this.#conn!.url;
  }

  setLogLevel(log: LogLevel): void {
    this.app.logLevel = log;
  }

  /**
   * @internal
   */
  collection(colPath: string): CollectionReference {
    argCheck(colPath, "Invalid collection path", true, [typeStrings.STRING]);
    return new CollectionReference(this, colPath);
  }

  /**
   * @internal
   */
  dualityViewCollection(name: string): DualityViewColReference {
    argCheck(name, "Invalid collection path", true, [typeStrings.STRING]);
    return new DualityViewColReference(this, name);
  }

  /**
   * @internal
   */
  dualityViewDoc(docPath: string): DualityViewDocReference {
    argCheck(docPath, "Invalid document path", true, [typeStrings.STRING]);
    return new DualityViewDocReference(this, docPath);
  }

  /**
   * @internal
   */
  collectionGroup(name: string): Query<DocumentData, DocumentData> {
    argCheck(name, "Invalid collection group name", true, [typeStrings.STRING]);
    const colRef = new CollectionReference(this, "");
    const query = colRef.__copyQuery();
    query._col_group = name;
    return query;
  }

  /**
   * @internal
   */
  doc(docPath: string): DocumentReference {
    argCheck(docPath, "Invalid document path", false, [typeStrings.STRING]);
    return new DocumentReference(this, docPath);
  }

  /**
   * @internal
   */
  updateDocs (path: string): BulkUpdate {
    return new BulkUpdate(this, path);
  }

  /**
   * @internal
   */
  async runTransaction<T>(callback: (t: Transaction) => Promise<T>, attempts?: { maxAttempts: number }): Promise<T> {
    argCheck(callback, "Invalid callback passed", true, [typeStrings.FUNCTION]);
    const trans_name = createUniqueName();
    let trans = new Transaction(trans_name);
    let res: T | null = null;
    let temp_res: any = null;
    let success = false;
    const maxAttempts = attempts == null ? 5 : attempts.maxAttempts;
    let retry = maxAttempts;
    while (!success && retry > 0) {
      try {
        if (retry < maxAttempts) {
          trans.__reset();
        }
        res = await callback(trans);
        temp_res = await (trans as any).__makeOperations();
        success = true;
      } catch (e) {
        if (retry === 1) {
          throw e;
        }
        retry--;
        success = false;
        const baseDelay = 50;
        const maxDelay = 10000;
        const delay = Math.min(baseDelay * (2 ** (maxAttempts - retry)), maxDelay);
        const jitter = Math.random() * delay * 0.5;
        const waitTime = delay + jitter;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    return res ?? temp_res;
  }

  /**
   * @internal
   */
  batch(): WriteBatch {
    const trans_name = createUniqueName();
    return new WriteBatch(trans_name);
  }

  toJSON(): any {
    return {
      appName: this.app.name,
      type: this.type
    };
  }

  /**
   * @internal
   */
  loadBundle(data: ArrayBuffer | ReadableStream<Uint8Array> | string): any {
    nullCheck(data, "Invalid data.");
    if (!(data instanceof ReadableStream || data instanceof ArrayBuffer || typeof data === 'string')) {
      const error = new Error("Supported data types for bundle load are ArrayBuffer, ReadableStream<Uint8Array> and string") as Error & { status?: number };
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    return null;
  }

  /**
   * @internal
   */
  async namedQuery(name: string): Promise<Query> {
    const error = new Error("Not implemented") as any;
    error.status = 501;
    throw oracledbErrorHandler(error);
  }
}
