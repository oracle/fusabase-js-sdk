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

import { Oracledb } from "../internal/core.js";
import { WriteBatch } from "../transaction/batch.js";
import { oracledbErrorHandler } from "../util/utils.js";
import { Transaction } from "../transaction/batch.js";
/**
 * Executes a transaction on the Oracledb/Oracledb instance.
 * @param db - Oracledb or Oracledb instance.
 * @param updateFunction - Function to execute within the transaction.
 * @param options - Optional configuration for transaction, e.g. { maxAttempts }
 */
export async function runTransaction<T>(
  db: Oracledb | Oracledb,
  updateFunction: (transaction: Transaction) => Promise<T>,
  options?: { maxAttempts?: number }
): Promise<T> {
  if (!(db instanceof Oracledb)) {
    const error = new Error("Invalid reference") as Error & { status?: number };
    error.status = 400;
    throw oracledbErrorHandler(error);
  }

  const transactionOptions = options?.maxAttempts !== undefined ? options : { maxAttempts: 5 };

  // Assume Oracledb and Oracledb both provide compatible runTransaction.
  // If not, specialize as needed for your codebase.
  return db.runTransaction(updateFunction, transactionOptions as { maxAttempts: number });
}


/**
  return db.runTransaction(updateFunction, options && options.maxAttempts !== undefined ? options : { maxAttempts: 5 });
}


/**
 * Creates a write batch instance for performing multiple writes as a single atomic operation.
 * 
 * @param db - Oracledb or Oracledb instance.
 * @returns WriteBatch instance for batching write operations.
 */
export function writeBatch(
  db: Oracledb | Oracledb
): WriteBatch {
  if (!(db instanceof Oracledb )) {
    const error = new Error("Invalid reference") as Error & { status?: number };
    error.status = 400;
    throw oracledbErrorHandler(error);
  }
  // Assume db.batch() returns a WriteBatch-compatible instance.
  return db.batch();
}
