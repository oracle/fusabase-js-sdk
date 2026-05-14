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

import { createUniqueName,oracledbErrorHandler,argCheck,typeStrings,Utils} from "../util/utils.js";
import { DocumentData } from "../types/common.js";
import { DocumentSnapshot } from "../document/snapshot.js";
import { DocumentReference } from "../document/reference.js";
import { UpdateData } from "../types/common.js";
import { FieldPath } from "../field/path.js";
import { LogLevel } from "../../../logger/LogLevel.js";
import { SetOptions } from "../types/common.js";
import { WithFieldValue } from "../types/data.js";

export class Transaction {
  #name: string | null = null;
  #status: number | null = null;
  #operations: any[] = [];
  #versions: Record<string, any> = {};

  /**
   * Creates a new Transaction instance.
   * @param name - Optional name for the transaction. If not provided, a unique name is generated.
   */
  constructor(name?: string) {
    this.#status = 0;
    this.#name = name ?? createUniqueName();
  }

  /** @internal */  __reset() {
    this.#name = createUniqueName();
    this.#status = 0;
    this.#operations = [];
    this.#versions = {};
  }

  /**
   * Reads a document in the context of this transaction.
   * @template AppModelType - The type of the application model.
   * @template DbModelType - The type of the database model, extending DocumentData.
   * @param docRef - The document reference to read.
   * @returns A promise that resolves to the document snapshot.
   */
  async get<AppModelType, DbModelType extends DocumentData>(docRef: DocumentReference<AppModelType, DbModelType>): Promise<DocumentSnapshot<AppModelType, DbModelType>> {
    if (this.#status === -1) {
      const err = new Error('Transaction has ended!') as Error & { status?: number };
      err.status = 400;
      throw oracledbErrorHandler(err);
    }
    const trans_obj = {
      name: this.#name,
      start: 1 - (this.#status || 0),
      end: 0,
    };
    if (this.#status === 0) {
      this.#status = 1;
    }
    this.#operations.push({
      method: 'get',
      docRef,
      data: null,
      options: null,
      version: null,
    });
    const res = await docRef.get({ source: 'server' }, trans_obj);
    this.#versions[docRef.path] = (res as any).__version;
    return res as any;
  }

  /**
   * Queues a delete operation in this transaction.
   * @template AppModelType - The type of the application model.
   * @template DbModelType - The type of the database model, extending DocumentData.
   * @param docRef - The document reference to delete.
   * @returns This Transaction instance for chaining.
   */
  delete<AppModelType, DbModelType extends DocumentData>(
    docRef: DocumentReference<AppModelType, DbModelType>
  ): Transaction {
    if (!(docRef instanceof DocumentReference)) {
      const error = new Error('Invalid document reference passed') as Error & { status?: number };
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    if (this.#status === -1) {
      const err = new Error('Transaction has ended!') as Error & { status?: number };
      err.status = 400;
      throw oracledbErrorHandler(err);
    }
    this.#operations.push({
      method: 'delete',
      docRef,
      data: null,
      options: null,
    });
    return this;
  }

  /**
   * Queues a set operation in this transaction.
   * @template AppModelType - The type of the application model.
   * @template DbModelType - The type of the database model, extending DocumentData.
   * @param docRef - The document reference to set.
   * @param data - The data to set on the document.
   * @param options - Options for the set operation.
   * @returns This Transaction instance for chaining.
   */
  set<AppModelType, DbModelType extends DocumentData>(
    docRef: DocumentReference<AppModelType, DbModelType>,
    data: Partial<AppModelType> | WithFieldValue<AppModelType>,
    options?: SetOptions
  ): Transaction {
    if (!(docRef instanceof DocumentReference)) {
      const error = new Error('Invalid document reference passed') as Error & { status?: number };
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    argCheck(data, 'Invalid data', true, [typeStrings.OBJECT]);
    if (this.#status === -1) {
      const err = new Error('Transaction has ended!') as Error & { status?: number };
      err.status = 400;
      throw oracledbErrorHandler(err);
    }
    if (options == null) {
      options = {
        merge: false,
        mergeFields: [],
      };
    }
    this.#operations.push({
      method: 'set',
      docRef,
      data,
      options,
    });
    return this;
  }

  /**
   * Updates fields in a document within this transaction.
   * @template AppModelType - The type of the application model.
   * @template DbModelType - The type of the database model, extending DocumentData.
   * @param docRef - The document reference to update.
   * @param data - An object containing the fields and values to update.
   * @returns This Transaction instance for chaining.
   */
  update<AppModelType, DbModelType extends DocumentData>(docRef:
    DocumentReference<AppModelType, DbModelType>,
    data: UpdateData<DbModelType>) : Transaction;
  /**
   * Updates fields in a document within this transaction using field/value pairs.
   * @template AppModelType - The type of the application model.
   * @template DbModelType - The type of the database model, extending DocumentData.
   * @param docRef - The document reference to update.
   * @param field - The field to update (string or FieldPath).
   * @param value - The value to set for the field.
   * @param moreFieldsAndValues - Additional field/value pairs.
   * @returns This Transaction instance for chaining.
   */
  update<AppModelType, DbModelType extends DocumentData>(docRef:
    DocumentReference<AppModelType, DbModelType>, field: string | FieldPath,
    value: unknown, ...moreFieldsAndValues: unknown[]): Transaction;
  update<AppModelType, DbModelType extends DocumentData>(
    docRef: DocumentReference<AppModelType, DbModelType>,
    dataOrField: UpdateData<DbModelType> | string | FieldPath,
    value?: unknown,
    ...moreFieldsAndValues: unknown[]
  ): Transaction {
    if (this.#status === -1) {
      const err = new Error('Transaction has ended!') as Error & { status?: number };
      err.status = 400;
      throw oracledbErrorHandler(err);
    }
    let data: Record<string, any>;
    if (
      typeof dataOrField === 'object' &&
      !(dataOrField instanceof FieldPath) &&
      !Array.isArray(dataOrField)
    ) {
      // Object form: update(docRef, { field: value, ... })
      const objectData = dataOrField as Record<string, unknown>;
      data = {};
      (Object.entries(objectData) as [string | FieldPath, any][]).forEach(([key, val]) => {
        const fieldKey = key instanceof FieldPath
          ? (key as FieldPath).fullPathSec
          : key;
        data[fieldKey] = val;
      });
    } else {
      // Field/value pairs: update(docRef, field, value, ...)
      data = {};
      data[
        dataOrField instanceof FieldPath
          ? dataOrField.fullPathSec
          : (dataOrField as string)
      ] = value;
      for (let i = 0; i < moreFieldsAndValues.length; i += 2) {
        const field = moreFieldsAndValues[i];
        const val = moreFieldsAndValues[i + 1];
        data[
          field instanceof FieldPath
            ? field.fullPathSec
            : (field as string)
        ] = val;
      }
    }
    if (!(docRef instanceof DocumentReference)) {
      const error = new Error('Invalid document reference passed') as Error & { status?: number };
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    this.#operations.push({
      method: 'update',
      docRef: docRef,
      data: data,
      options: null,
    });
    return this;
  }

  /**
   * @internal
   */
  async __makeOperations(): Promise<any> {
    const j = this.#operations.length - 1;
    if (j < 0) {
      this.#status = -1;
      return null;
    }
    for (let i = 0; i < j; i++) {
      if (this.#operations[i].method === "get") {
        continue;
      }
      const trans_obj = {
        name: this.#name,
        start: 1 - (this.#status as number),
        end: 0,
        version: this.#versions[this.#operations[i].docRef.path],
      };
      if (this.#status === 0) {
        this.#status = 1;
      }
      switch (this.#operations[i].method) {
        case "set":
          await this.#operations[i].docRef.set(
            this.#operations[i].data,
            this.#operations[i].options,
            trans_obj
          );
          break;
        case "delete":
          await this.#operations[i].docRef.delete(trans_obj);
          break;
        case "update":
          await this.#operations[i].docRef.update(
            this.#operations[i].data,
            trans_obj
          );
          break;
        default:
          Utils.baasLogger(LogLevel.ERROR, "incorrect");
      }
      this.#versions[this.#operations[i].docRef.path] = trans_obj.version;
    }
    const res = await this.#commit(j);
    this.#status = -1;
    return res;
  }

  /**
   * @internal
   */
  async #commit(idx: number): Promise<any> {
    const trans_obj = {
      name: this.#name,
      start: 1 - (this.#status as number),
      end: 1,
      version: this.#versions[this.#operations[idx].docRef.path],
    };
    let res: any = null;
    switch (this.#operations[idx].method) {
      case "set":
        res = await this.#operations[idx].docRef.set(
          this.#operations[idx].data,
          this.#operations[idx].options,
          trans_obj
        );
        break;
      case "delete":
        res = await this.#operations[idx].docRef.delete(trans_obj);
        break;
      case "update":
        res = await this.#operations[idx].docRef.update(
          this.#operations[idx].data,
          trans_obj
        );
        break;
      case "get":
        res = await this.#operations[idx].docRef.get(
          { source: "server" },
          trans_obj
        );
        break;
      default:
        Utils.baasLogger(LogLevel.ERROR, "incorrect");
    }
    this.#versions[this.#operations[idx].docRef.path] = trans_obj.version;
    return res;
  }
}



export class WriteBatch {
  #name: string | null = null;
  #status: number | null = null;
  #operations: any[] = [];

  /**
   * Creates a new WriteBatch instance.
   * @param name - Optional name for the write batch.
   */
  constructor(name?: string) {
    this.#status = 0;
    this.#name = name || null;
  }

  /**
   * Queues a set operation in this WriteBatch.
   * @template T - The type of the document data.
   * @param docRef - The document reference to set.
   * @param data - The data to set on the document.
   * @returns This WriteBatch instance for chaining.
   */
  set<T>(docRef: DocumentReference<T>, data: WithFieldValue<T>): WriteBatch {
    if (!(docRef instanceof DocumentReference)) {
      const error = new Error("Invalid document reference passed") as Error & { status?: number };
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    argCheck(data, "Invalid data", true, [typeStrings.OBJECT]);
    const options = { merge: false, mergeFields: [] }; // Default behavior
    this.#operations.push({
      method: "set",
      docRef,
      data,
      setOptions: options
    });
    return this;
  }

  /**
   * Updates fields in a document within this WriteBatch.
   * @template AppModelType - The type of the application model.
   * @template DbModelType - The type of the database model, extending DocumentData.
   * @param docRef - The document reference to update.
   * @param data - An object containing the fields and values to update.
   * @returns This WriteBatch instance for chaining.
   */
update<AppModelType, DbModelType extends DocumentData>(documentRef:
  DocumentReference<AppModelType, DbModelType>,
  data: UpdateData<DbModelType>): WriteBatch;
  /**
   * Updates fields in a document within this WriteBatch using field/value pairs.
   * @template AppModelType - The type of the application model.
   * @template DbModelType - The type of the database model, extending DocumentData.
   * @param docRef - The document reference to update.
   * @param field - The field to update (string or FieldPath).
   * @param value - The value to set for the field.
   * @param moreFieldsAndValues - Additional field/value pairs.
   * @returns This WriteBatch instance for chaining.
   */
update<AppModelType, DbModelType extends DocumentData>(documentRef:
  DocumentReference<AppModelType, DbModelType>, field: string | FieldPath,
  value: unknown, ...moreFieldsAndValues: unknown[]): WriteBatch;
update<AppModelType, DbModelType extends DocumentData>(
  docRef: DocumentReference<AppModelType, DbModelType>,
  dataOrField: UpdateData<DbModelType> | string | FieldPath,
  value?: unknown,
  ...moreFieldsAndValues: unknown[]
): WriteBatch  {
    let data: Record<string, any>;
    if (
      typeof dataOrField === 'object' &&
      !(dataOrField instanceof FieldPath) &&
      !Array.isArray(dataOrField)
    ) {
      // Object form: update(docRef, { field: value, ... })
      const objectData = dataOrField as Record<string, unknown>;
      data = {};
      (Object.entries(objectData) as [string | FieldPath, any][]).forEach(([key, val]) => {
        data[key instanceof FieldPath ? key.fullPathSec : key] = val;
      });
    } else {
      // Field/value pairs: update(docRef, field, value, ...)
      data = {};
      data[dataOrField instanceof FieldPath ? dataOrField.fullPathSec : dataOrField as string] = value;
      for (let i = 0; i < moreFieldsAndValues.length; i += 2) {
        const field = moreFieldsAndValues[i];
        const val = moreFieldsAndValues[i + 1];
        data[field instanceof FieldPath ? field.fullPathSec : field as string] = val;
      }
    }
    if (!(docRef instanceof DocumentReference)) {
      const error = new Error("Invalid document reference passed") as Error & { status?: number };
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    this.#operations.push({
      method: "update",
      docRef,
      data,
      options: null
    });
    return this;
  }

  /**
   * Queues a delete operation in this WriteBatch.
   * @template T - The type of the document data.
   * @param docRef - The document reference to delete.
   * @returns This WriteBatch instance for chaining.
   */
  delete<T>(docRef: DocumentReference<T>): WriteBatch {
    if (!(docRef instanceof DocumentReference)) {
      const error = new Error("Invalid document reference passed") as Error & { status?: number };
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    this.#operations.push({
      method: "delete",
      docRef,
      data: null,
      options: null
    });
    return this;
  }

  /**
   * @internal
   */
  async __makeOperations(): Promise<number | null> {
    const j = this.#operations.length - 1;
    if (j < 0) {
      this.#status = -1;
      return null;
    }
    for (let i = 0; i < j; i++) {
      const trans_obj = {
        name: this.#name,
        start: 1 - (this.#status as number),
        end: 0
      };
      if (this.#status === 0) {
        this.#status = 1;
      }
      switch (this.#operations[i].method) {
        case "set":
          await this.#operations[i].docRef.set(
            this.#operations[i].data,
            this.#operations[i].setOptions,
            trans_obj
          );
          break;
        case "delete":
          await this.#operations[i].docRef.delete(trans_obj);
          break;
        case "update":
          await this.#operations[i].docRef.update(
            this.#operations[i].data,
            trans_obj
          );
          break;
        default:
          Utils.baasLogger(LogLevel.ERROR, "incorrect");
      }
    }
    return j;
  }

  /**
   * Commits all the writes in this WriteBatch as a single atomic operation.
   * @returns A promise that resolves when the commit is complete.
   */
  async commit(): Promise<void> {
    const idx = await this.__makeOperations();
    if (idx === null) return;
    const trans_obj = {
      name: this.#name,
      start: 1 - (this.#status as number),
      end: 1
    };
    this.#status = -1;
    switch (this.#operations[idx].method) {
      case "set":
        await this.#operations[idx].docRef.set(
          this.#operations[idx].data,
          this.#operations[idx].setOptions,
          trans_obj
        );
        break;
      case "delete":
        await this.#operations[idx].docRef.delete(trans_obj);
        break;
      case "update":
        await this.#operations[idx].docRef.update(
          this.#operations[idx].data,
          trans_obj
        );
        break;
      default:
        Utils.baasLogger(LogLevel.ERROR, "incorrect");
    }
  }
}
