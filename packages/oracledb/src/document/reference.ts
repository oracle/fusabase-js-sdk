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
import { oracledbErrorHandler,checkOracledbApiVersion,OracledbVersion,typeStrings,Utils,argCheck,getAccessToken,getToken, snapHashcode, rearrangeBodyOfVersion2 } from '../util/utils.js';
import { parseTimestamp,updateNestedData,setWholeData,createPayloadForUpdateVersion2New, serializeVersion2, extractCallbacksForSnapshot} from '../util/utils_helper.js';
import { createUniqueName } from '../util/utils.js';
import { CollectionReference, DualityViewColReference } from '../collection/reference.js';
import { OracledbDataConverter } from '../types/converter.js';
import { FieldPath } from '../field/path.js';
import { QueryHelper } from '../util/utils.js';
import { DocumentSnapshot } from './snapshot.js';
import { SnapshotMetadata } from '../listener/snapshot.js';
import { IdTokenResult } from '../../../auth/src/types/idtoken.js';

export class DocumentReference<
  AppModelType = DocumentData,
  DbModelType extends DocumentData = DocumentData
> {
  /** @internal */
  /** @internal */  _queryHelper: QueryHelper | null = null;
  /** @internal */
  /** @internal */  _rt: number = 0;
  converter: OracledbDataConverter<AppModelType, DbModelType> | null = null;
  readonly oracledb: any;
  readonly type: string = "document";
  readonly id: string;
  readonly parent: CollectionReference<AppModelType, DbModelType>;
  /** @internal */
  /** @internal */  _path: string[];
  /** @internal */ _serverTimestamp:any[] = [];
  
  constructor(
    db: any,
    path?: string,
    parent: CollectionReference<any, any> | null = null
  ) {
    this.converter = null;
    if (((!path || path === "") && parent == null)) {
      let error = new Error("Both path and parent cannot be null!");
      (error as any).status = 400;
      throw oracledbErrorHandler(error);
    }

    if (!path || path === "") {
      path = createUniqueName();
    }
    this._rt = 0;
    path = path.toString().trim();
    let tokens = path.split("/");
    if (Utils.isTypeOf(parent, DocumentReference) && tokens.length % 2 === 1) {
      let error = new Error("Incorrect path for Collection");
      (error as any).status = 400;
      throw oracledbErrorHandler(error);
    }
    this.oracledb = db;
    this.id = tokens.pop()!;
    if (this.id === "") {
      let error = new Error("Incorrect document id!");
      (error as any).status = 400;
      throw oracledbErrorHandler(error);
    }
    if (tokens.length === 0) this.parent = parent as any;
    else this.parent = new CollectionReference(db, tokens.join("/"), parent as any);
    this._path = this.parent ? [...this.parent._path] : [];
    this._path.push(this.id);
    if (this.parent == null) {
      let error = new Error("Parent Collection can't be null");
      (error as any).status = 400;
      throw oracledbErrorHandler(error);
    }
    this._queryHelper = new QueryHelper(db.app);
  }

  /**
   * The full path of this document relative to the root of the database.
   */
  get path(): string {
    return this._path.join("/");
  }

  /**
   * @internal
   */
  isEqual(
    docRef: DocumentReference<any, any>
  ): boolean {
    if (!(docRef instanceof DocumentReference)) {
      let error = new Error("The other instance to be compared should be an instance of DocumentReference");
      (error as any).status = 400;
      throw oracledbErrorHandler(error);
    }
    return this.id === docRef.id && this.path === docRef.path;
  }

  /**
   * Returns the CollectionReference for the collection at the specified path.
   */
  /**
   * @internal
   */
  collection<ColAppModelType = DocumentData, ColDbModelType extends DocumentData = DocumentData>(
    colPath: string
  ): CollectionReference<ColAppModelType, ColDbModelType> {
    argCheck(colPath, "Invalid collection path", true, [typeStrings.STRING]);
    let newCol = new CollectionReference<ColAppModelType, ColDbModelType>(this.oracledb, colPath, this as any);
    newCol.converter = this.converter as any;
    return newCol;
  }

  /**
   * @internal
   */
  async get(
    options: { source: "server" | "cache" | "default" } = { source: "server" },
    trans_obj: any = null
  ): Promise<DocumentSnapshot<AppModelType>> {
    let promJson;
    const access_token = await getAccessToken(this.oracledb.app);
    try {
      promJson = await this._queryHelper!.fetchDocuments(this as any, access_token? access_token : undefined, trans_obj);
      if (!promJson || !promJson['ret'] || !promJson['ret'][0]) {
        let error = new Error("DocumentID not found");
        (error as any).status = 404;
        throw error;
      }
    } catch (err) {
      Utils.baasTrace(this.oracledb.app.logLevel);
      return new DocumentSnapshot(null, this);
    }
    if (promJson) {
      let data = promJson["ret"][0];
      let doc = data["osons"];
      if (data["brid"]) doc["ROWID"] = data["brid"];
      const _meta = new SnapshotMetadata(false, false);
      return new DocumentSnapshot(doc, this, _meta);
    }
    return new DocumentSnapshot(null, this);
  }

  /**
   * @internal
   */
  async update(...args: any[]): Promise<void> {
    let data_obj: any;
    let trans_obj: any = { name: "", start: 0, end: 0 };
    if (args.length === 1) {
      data_obj = args[0];
    } else if (typeof args[0] === 'string' || args[0] instanceof FieldPath) {
      data_obj = {}
      for (let i = 0; i < args.length - 1; i++) {
        let temp = args[i];
        if (temp instanceof FieldPath) temp = temp.fullPathSec;
        data_obj[temp] = args[i + 1];
      }
    } else if (args.length === 2 && typeof args[0] === 'object') {
      data_obj = args[0];
      trans_obj = args[1];
    }
    let data = data_obj;
    if (checkOracledbApiVersion(this.oracledb.app.options, OracledbVersion.VER_1)) {
      let doc_data = null;
      try {
        doc_data = await this.get(undefined, {
          name: trans_obj.name,
          start: trans_obj.start,
          end: 0,
          version: trans_obj.version
        });
        if (trans_obj.start === 1) trans_obj.start = 0;
      } catch (e) {
        let error = new Error("Error occured while fetching document during update.");
        (error as any).status = 500;
        throw error;
      }
      data = updateNestedData(this, doc_data["_data"], data_obj);
      data = parseTimestamp(data);
    } else if (checkOracledbApiVersion(this.oracledb.app.options, OracledbVersion.VER_2)) {
      data = createPayloadForUpdateVersion2New(this, data, false);
      data = parseTimestamp(data);
      data = rearrangeBodyOfVersion2(data);
    }
    const access_token = await getAccessToken(this.oracledb.app);
    try {
      await this._queryHelper!.updateDocument(
        this as any, data, access_token ?? undefined, trans_obj);
    } catch (err) {
      Utils.baasTrace(this.oracledb.app.logLevel);
      throw oracledbErrorHandler(err);
    }
  }

  /**
   * @internal
   */
  async delete(trans_obj: any = null): Promise<void> {
    const access_token = await getAccessToken(this.oracledb.app);
    try {
      await this._queryHelper!.deleteDocument(this as any, access_token ?? undefined, trans_obj);
    } catch (err) {
      Utils.baasTrace(this.oracledb.app.logLevel);
      throw oracledbErrorHandler(err);
    }
    Utils.baasLogger(this.oracledb.app.logLevel, "deleteDoc called");
  }

  /**
   * @internal
   */
  async set(
    data_obj: AppModelType,
    setOptions?: { merge?: boolean; mergeFields?: string[] },
    trans_obj: any = null
  ): Promise<void> {
    if (this.converter != null) {
      data_obj = this.converter.toOracledb(data_obj) as any;
    }
    if (!trans_obj) trans_obj = { name: "", start: 0, end: 0 };
    argCheck(data_obj, "Invalid data", true, [typeStrings.OBJECT]);
    argCheck(setOptions, "Invalid options passed", false, [typeStrings.OBJECT]);
    let data:any = data_obj;
    if (!setOptions) setOptions = { merge: false, mergeFields: [] };
    if (checkOracledbApiVersion(this.oracledb.app.options, OracledbVersion.VER_1)) {
      if (setOptions && (setOptions.merge ||
        (setOptions.mergeFields && setOptions.mergeFields.length > 0))) {
        let doc_data = null;
        try {
          doc_data = await this.get(undefined, {
            name: trans_obj.name,
            start: trans_obj.start,
            end: 0,
            version: trans_obj.version
          });
          if (trans_obj.start === 1) trans_obj.start = 0;
        } catch (e) {
          let error = new Error("No such doc exists!");
          (error as any).status = 404;
          throw error;
        }
        data = updateNestedData(this, doc_data["_data"], data_obj);
      } else {
        data = setWholeData(this, {}, data_obj, true);
      }
      data = parseTimestamp(data);
    } else if (checkOracledbApiVersion(this.oracledb.app.options, OracledbVersion.VER_2)) {
      if (setOptions && setOptions.merge) {
        data = createPayloadForUpdateVersion2New(this, data, setOptions.merge);
      } else {
        data = serializeVersion2(this, data, false)
      }
      data = parseTimestamp(data);
      data = rearrangeBodyOfVersion2(data);
    }
    const access_token = await getAccessToken(this.oracledb.app);
    if (!Utils.memberExists(setOptions, "merge")) { setOptions.merge = false; }
    if (!Utils.memberExists(setOptions, "mergeFields")) { setOptions.mergeFields = []; }
    try {
      await this._queryHelper!.setDocument(
        this as any, data, setOptions, access_token ?? undefined, trans_obj);
    } catch (err) {
      Utils.baasTrace(this.oracledb.app.logLevel);
      throw oracledbErrorHandler(err);
    }
  }

  /**
   * @internal
   */
  #updateListenersCount(x: number) {
    let total_listeners_init:any = window.localStorage.getItem(this.oracledb.__listenerKey);
    if (total_listeners_init == null) total_listeners_init = 0;
    if (this.oracledb.__listening === 0) {
      window.localStorage.setItem(this.oracledb.__listenerKey,
        String(parseInt(total_listeners_init as any) + x));
      this.oracledb.__listening = x;
    }
  }

  /**
   * @internal
   */
  onSnapshot(...args: any[]): () => void {
    let unsubscribe: () => void;

    this.#updateListenersCount(1);

    // Extract callbacks
    let callback = extractCallbacksForSnapshot(...args);
    const _queryId = createUniqueName();

    let tok =  getToken(this.oracledb.app);
    if (tok) {
      tok = new IdTokenResult(tok);
    }
    const access_token = tok;
    const payload = {
      path: this._path,
      conditions: [] as any[],
      explicitOrder: [] as any[],
      access_token: access_token ? access_token.claims.sub : null
    };

    const mappedQueryId = Math.abs(snapHashcode(JSON.stringify(payload)));
    delete (payload as any)["access_token"];
    const queryId = Math.abs(snapHashcode(JSON.stringify(payload)));

    const handleSnapshot = (docSnap: any) => {
      if (callback.next) {
        try {
          callback.next(docSnap);
        } catch (ue) {
          Utils.baasLogger(this.oracledb.app.logLevel, "Error in snapshot callback ", ue);
        }
      }
    };

    if (
      !this.oracledb._settings.experimentalAutoDetectLongPolling &&
      !this.oracledb._settings.experimentalForceLongPolling
    ) {
      // WebSocket-based snapshot
      this.oracledb.__createSocket(access_token ? access_token.token : null);

      const queryObject = { queryId, status: 1, payload };

      if (!Utils.memberExists(this.oracledb.__snaps, queryId)) {
        this.oracledb.__snaps[queryId] = [];
        Utils.baasLogger(this.oracledb.app.logLevel, "__sendMessage ", queryObject);
        this.oracledb.__sendMessage(queryObject);
      }

      this.oracledb.__snaps[queryId].push(_queryId);
      this.oracledb.__callbacks[_queryId] = callback;
      this.oracledb.__queryIdMap[queryId] = mappedQueryId;

      this.get()
        .then((docSnap) => {
          handleSnapshot(docSnap);
          this.oracledb.__setIndexDB({
            queryId: mappedQueryId,
            snap: docSnap,
            type: "document",
            path: this._path.join("/")
          })
            .then(() => {
              Utils.baasLogger(this.oracledb.app.logLevel, "added indexed db for document", _queryId);
            })
            .catch((e:any) => Utils.baasLogger(this.oracledb.app.logLevel, e));
        })
        .catch((e) => {
          if (callback.error) {
            try {
              callback.error(e);
            } catch (ue) {
              Utils.baasLogger(this.oracledb.app.logLevel, "Error in snapshot callback ", ue);
            }
          }
        });

      unsubscribe = () => {
        Utils.baasLogger(this.oracledb.app.logLevel, "in unsubscribe for document", this.oracledb.__snaps[queryId]);
        const index = this.oracledb.__snaps[queryId].indexOf(_queryId);
        if (index > -1) {
          this.oracledb.__snaps[queryId].splice(index, 1);
          delete this.oracledb.__callbacks[_queryId];
        }

        const unSubQueryObject = { queryId, status: 0, payload };

        if (this.oracledb.__snaps[queryId].length === 0) {
          delete this.oracledb.__queryIdMap[queryId];
          delete this.oracledb.__snaps[queryId];
          this.oracledb.__sendMessage(unSubQueryObject);
        }

        if (callback.error) {
          try {
            callback.error(new Error("Unsubscribe called!"));
          } catch (ue) {
            Utils.baasLogger(this.oracledb.app.logLevel, "Error in snapshot callback ", ue);
          }
        }

        callback = { next: null, complete: null, error: null };
      };
    } else {
      // Long polling fallback
      this._rt = 1;
      const db = this.oracledb;
      let lastDocUpdate: any = null;

      const getSnap = () => {
        this.get().then(docSnap => {
          let newVer = null;
          if (docSnap._otherMetadata["ASOF"]) {
            newVer = BigInt(docSnap._otherMetadata["ASOF"]);
          } else {
            newVer = BigInt(docSnap._otherMetadata["VERSION"]);
          }
          if (!lastDocUpdate || !newVer
            || lastDocUpdate < newVer) 
          {
            lastDocUpdate = newVer;
            handleSnapshot(docSnap);
          }
        }
        ).catch(e => { Utils.baasLogger(this.oracledb.app.logLevel, e); });
      }

      getSnap();

      const intervalId = setInterval(
        getSnap,
        (this.oracledb._settings.experimentalLongPollingOptions?.timeoutSeconds || 10) * 1000
      );

      unsubscribe = () => {
        clearInterval(intervalId);
        if (callback.error) {
          try {
            callback.error(new Error("Unsubscribe called!"));
          } catch (ue) {
            Utils.baasLogger(db.app.logLevel, "Error in snapshot callback ", ue);
          }
        }
        Utils.baasLogger(db.app.logLevel, "Polling stopped.");
      };
    }

    return () => unsubscribe();
  }

  /**
   * Applies a custom data converter to this DocumentReference.
   */
  withConverter<NewAppModelType, NewDbModelType extends DocumentData>(
    converter: OracledbDataConverter<NewAppModelType, NewDbModelType>
  ): DocumentReference<NewAppModelType, NewDbModelType>;
  withConverter(): DocumentReference<AppModelType, DbModelType>;
  withConverter<NewAppModelType, NewDbModelType extends DocumentData>(
    converter?: OracledbDataConverter<NewAppModelType, NewDbModelType>
  ):
    | DocumentReference<NewAppModelType, NewDbModelType>
    | DocumentReference<AppModelType, DbModelType> {
    const doc = new DocumentReference(
      this.oracledb,
      this._path.join('/'),
      null
    );
    doc.converter = (converter ?? null) as any;
    return doc as any;
  }
}

/* ===========================
   DualityViewDocReference
   =========================== */
export class DualityViewDocReference<
  AppModelType = DocumentData,
  DbModelType extends DocumentData = DocumentData
> {
  private _queryHelper: QueryHelper | null = null;
  private _rt: number = 0;
  converter: any;
  oracledb: any;
  id: string;
  type: string;
  parent: DualityViewColReference<AppModelType, DbModelType>;
  /** @internal */  _path: string[];

  constructor(db: any, path: string, parent: DualityViewColReference<any, any> | null = null) {
    if ((path == null || path === '') && parent == null) {
      const error: any = new Error('Both path and parent cannot be null!');
      error.status = 400;
      throw oracledbErrorHandler(error);
    }

    this.converter = null;
    this._rt = 0;

    if (path == null || path === '') {
      path = createUniqueName();
    }
    path = path.toString().trim();
    const tokens = path.split('/');

    this.oracledb = db;
    this.type = 'dualityviewdocument';
    this.id = tokens.pop()!;

    if (this.id === '') {
      const error: any = new Error('Incorrect duality view document id!');
      error.status = 400;
      throw oracledbErrorHandler(error);
    }

    // compute parent and _path
    const parPath = parent ? parent._path.join('/') : '';
    if (tokens.length === 0) this.parent = parent as any;
    else this.parent = new DualityViewColReference(db, (parPath ? parPath + '/' : '') + tokens.join('/'));

    if (this.parent != null) {
      this._path = Array.from(this.parent._path);
    } else {
      this._path = [];
    }
    this._path.push(this.id);

    if (this.parent == null) {
      const error: any = new Error("Parent Collection can't be null");
      error.status = 400;
      throw oracledbErrorHandler(error);
    }

    if (this._path.length != 2) {
      const error: any = new Error('Incorrect path for DuaityView document');
      error.status = 400;
      throw oracledbErrorHandler(error);
    }

    this._queryHelper = new QueryHelper(db.app);
  }

  get path(): string {
    return this._path.join('/');
  }

  isEqual(docRef: any): boolean {
    if (!(docRef instanceof DualityViewDocReference)) {
      const error: any = new Error(
        'The other instance to be compared should be an       instance of DualityViewDocReference'
      );
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    return this.id === docRef.id && this.path === docRef.path;
  }

  /**
   * @internal
   */
  async get(options: { source: "server" | "cache" | "default" } = { source: "server" },
     trans_obj: any = null): Promise<DocumentSnapshot<AppModelType>>  {
    let promJson: any;
    const access_token = await getAccessToken(this.oracledb.app);
    try {
      promJson = await this._queryHelper?.fetchDocuments(this as any, access_token ?? undefined, trans_obj);

      if (!promJson || !promJson['ret'] || !promJson['ret'][0]) {
        const error: any = new Error(`DocumentID not found`);
        error.status = 404;
        throw error;
      }
    } catch (err) {
      Utils.baasTrace(this.oracledb.app.logLevel);
      return new DocumentSnapshot(null, this);
    }

    if (promJson) {
      const data = promJson['ret'][0];
      const doc = data['osons'];
      if (data['brid']) {
        doc['ROWID'] = data['brid'];
      }
      const _meta = new SnapshotMetadata(false, false);
      const docSnap = new DocumentSnapshot(doc, this, _meta);
      Utils.baasLogger(this.oracledb.app.logLevel, docSnap);
      return docSnap;
    }
    return new DocumentSnapshot(null, this);
  }

  /**
   * update(...) signature mirrors original:
   * - update(data)
   * - update(fieldPathOrString, value, fieldOrString2, value2, ...)
   * - update(data, trans_obj)
   */
  /**
   * @internal
   */
  async update(...args: any[]): Promise<void> {
    let data_obj: any;
    let trans_obj: any = { name: "", start: 0, end: 0 };
    if (args.length === 1) {
      data_obj = args[0];
    } else if (typeof args[0] === 'string' || args[0] instanceof FieldPath) {
      data_obj = {}
      for (let i = 0; i < args.length - 1; i++) {
        let temp = args[i];
        if (temp instanceof FieldPath) temp = temp.fullPathSec;
        data_obj[temp] = args[i + 1];
      }
    } else if (args.length === 2 && typeof args[0] === 'object') {
      data_obj = args[0];
      trans_obj = args[1];
    }
    let data = data_obj;

    if (checkOracledbApiVersion(this.oracledb.app.options, OracledbVersion.VER_1)) {
      let doc_data: any = null;
      try {
        doc_data = await this.get(undefined, {
           name: trans_obj.name,
           start: trans_obj.start, 
           end: 0, 
           version: trans_obj.version 
        });
        if (trans_obj.start === 1) {
          trans_obj.start = 0;
        }
      } catch (e) {
        const error: any = new Error(`Error occured while fetching docunent during update.`);
        error.status = 500;
        throw error;
      }
      data = updateNestedData(this, doc_data['_data'], data_obj);
      data = parseTimestamp(data);
    } else if (checkOracledbApiVersion(this.oracledb.app.options, OracledbVersion.VER_2)) {
      data = createPayloadForUpdateVersion2New(this, data, false);
      data = parseTimestamp(data);
      data = rearrangeBodyOfVersion2(data);
    }

    const access_token = await getAccessToken(this.oracledb.app);

    try {
      await this._queryHelper?.updateDocument(this as any, data, access_token ?? undefined, trans_obj);
    } catch (err) {
      Utils.baasTrace(this.oracledb.app.logLevel);
      throw oracledbErrorHandler(err);
    }
  }

  /**
   * @internal
   */
  async delete(trans_obj: any): Promise<void> {
    const access_token = await getAccessToken(this.oracledb.app);

    try {
      await this._queryHelper?.deleteDocument(this as any, access_token ?? undefined, trans_obj);
    } catch (err) {
      Utils.baasTrace(this.oracledb.app.logLevel);
      throw oracledbErrorHandler(err);
    }
    Utils.baasLogger(this.oracledb.app.logLevel, 'deleteDoc called');
  }

  async set(data_obj: any, setOptions?: { merge?: boolean; mergeFields?: string[] } | null, trans_obj: any = null): Promise<void> {
    if (this.converter != null) {
      data_obj = this.converter.toOracledb(data_obj);
    }
    if (!trans_obj) {
      trans_obj = { name: '', start: 0, end: 0 };
    }
    argCheck(data_obj, 'Invalid data', true, [typeStrings.OBJECT]);
    argCheck(setOptions, 'Invalid options passed', false, [typeStrings.OBJECT]);

    let data = data_obj;
    if (setOptions == null) {
      setOptions = { merge: false, mergeFields: [] };
    }

    if (checkOracledbApiVersion(this.oracledb.app.options, OracledbVersion.VER_1)) {
      if (setOptions && (setOptions.merge || (setOptions.mergeFields && setOptions.mergeFields.length > 0))) {
        let doc_data: any = null;
        try {
          doc_data = await this.get(null as any, { name: trans_obj.name, start: (trans_obj as any).stack, end: 0, version: trans_obj.version });
          if (trans_obj.start === 1) {
            trans_obj.start = 0;
          }
        } catch (e) {
          const error: any = new Error(`No such doc exists!`);
          error.status = 404;
          throw error;
        }
        data = updateNestedData(this, doc_data['_data'], data_obj);
      } else {
        data = setWholeData(this, {}, data_obj, true);
      }

      data = parseTimestamp(data);
    } else if (checkOracledbApiVersion(this.oracledb.app.options, OracledbVersion.VER_2)) {
      if (setOptions && setOptions.merge) {
        data = createPayloadForUpdateVersion2New(this, data, setOptions.merge);
      } else {
        data = serializeVersion2(this, data, false)
      }
      data = parseTimestamp(data);
      data = rearrangeBodyOfVersion2(data);
    }
    

    const access_token = await getAccessToken(this.oracledb.app);

    if (Utils.memberExists(setOptions, 'merge')) {
      setOptions.merge = false;
    }
    if (Utils.memberExists(setOptions, 'mergeFields')) {
      setOptions.mergeFields = [];
    }
    try {
      await this._queryHelper?.setDocument(this as any, data, setOptions, access_token ?? undefined, trans_obj);
    } catch (err) {
      Utils.baasTrace(this.oracledb.app.logLevel);
      throw oracledbErrorHandler(err);
    }
  }

  /* Convert JS private method '#updateListenersCount' into a TS private method */
  /**
   * @internal
   */
  private _updateListenersCount(x: number) {
    let total_listeners_init: any = window.localStorage.getItem(this.oracledb.__listenerKey);
    if (total_listeners_init == null) {
      total_listeners_init = 0;
    }
    if (this.oracledb.__listening === 0) {
      window.localStorage.setItem(this.oracledb.__listenerKey, (parseInt(total_listeners_init, 10) || 0) + x + '');
      this.oracledb.__listening = x;
    }
  }

  /**
   * Applies a custom data converter to this DualityViewDocReference.
   */
  withConverter<NewAppModelType, NewDbModelType extends DocumentData>(
    converter: OracledbDataConverter<NewAppModelType, NewDbModelType>
  ): DualityViewDocReference<NewAppModelType, NewDbModelType>;
  withConverter(): DualityViewDocReference<AppModelType, DbModelType>;
  withConverter<NewAppModelType, NewDbModelType extends DocumentData>(
    converter?: OracledbDataConverter<NewAppModelType, NewDbModelType>
  ):
    | DualityViewDocReference<NewAppModelType, NewDbModelType>
    | DualityViewDocReference<AppModelType, DbModelType> {
    const doc = new DualityViewDocReference(
      this.oracledb,
      this._path.join('/'),
      null
    );
    doc.converter = (converter ?? null) as any;
    return doc as any;
  }
}
