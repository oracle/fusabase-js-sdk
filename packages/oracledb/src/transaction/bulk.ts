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
import { parseTimestamp,updateNestedData,setWholeData,createPayloadForUpdateVersion2New,extractCallbacksForSnapshot} from '../util/utils_helper.js';
import { updateFieldsWithQuotes ,isInstanceOfAnyClass,createUniqueName } from '../util/utils.js';
import { CollectionReference } from '../collection/reference.js';
import { OracledbDataConverter } from '../types/converter.js';
import { FieldPath } from '../field/path.js';
import { nullCheck } from '../util/utils.js';
import { QueryHelper } from '../util/utils.js';
import { SnapshotMetadata } from '../listener/snapshot.js';

export class BulkUpdate <
  AppModelType = DocumentData,
  DbModelType extends DocumentData = DocumentData
> {
  /** @internal */ _conditions: any[] = [];
  /** @internal */  _queryHelper: QueryHelper | null = null;
  /** @internal */
  readonly oracledb: any;
  /** @internal */ _ops: any[] = [];
  /** @internal */  _path: string[];
  
  constructor(
    db: any,
    path?: string
  ) {
    if (!path) {
      let error = new Error("Path cannot be null!");
      (error as any).status = 400;
      throw oracledbErrorHandler(error);
    }

    path = path.toString().trim();
    let tokens = path.split("/");
    if (tokens.length % 2 !== 1) {
      let error = new Error("Incorrect path");
      (error as any).status = 400;
      throw oracledbErrorHandler(error);
    }
    this.oracledb = db;
    this._path = tokens;
    this._queryHelper = new QueryHelper(db.app);
  }

  /**
   * The full path of this document relative to the root of the database.
   */
  get path(): string {
    return this._path.join("/");
  }

  isEqual(
    docRef: BulkUpdate<any, any>
  ): boolean {
    if (!(docRef instanceof BulkUpdate)) {
      let error = new Error("The other instance to be compared should be an instance of DocumentReference");
      (error as any).status = 400;
      throw oracledbErrorHandler(error);
    }
    return this.path === docRef.path;
  }

  where(field: string | FieldPath, opStr: string, fieldValue: any): BulkUpdate<AppModelType, DbModelType> {
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
      if (fieldValue == null && fieldValue == "") return this;
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
      let newQuery = this;
      newQuery._conditions.push(_cond);
      return newQuery;
    }

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
    data = createPayloadForUpdateVersion2New(this, data, true);
    data = parseTimestamp(data);
    data = rearrangeBodyOfVersion2(data);
    const access_token = await getAccessToken(this.oracledb.app);
    try {
      await this._queryHelper!.updateDocument(
        this as any, data, access_token ?? undefined, trans_obj);
    } catch (err) {
      Utils.baasTrace(this.oracledb.app.logLevel);
      throw oracledbErrorHandler(err);
    }
  }

}
