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

import { FieldValue } from "../field/value.js";
import {
  DenseEmbedding,
  SparseEmbedding,
} from "../types/vector.js";
import {
  validateDenseVector,
  validateSparseEmbedding,
} from "../util/utils.js";

/**
 * Creates a dense embedding payload.
 *
 * @example
 * await updateDoc(docRef, {
 *   DENSE_EMB: denseVector([0.12, -0.91, 0.44])
 * });
 *
 * @example
 * await addDoc(collection(db, "docs"), {
 *   title: "vector doc",
 *   DENSE_EMB: denseVector([0.12, -0.91, 0.44])
 * });
 */
export function denseVector(values: number[]): DenseEmbedding {
  validateDenseVector(values, "denseVector values must be a numeric array.");
  return { type: "dense", values };
}

/**
 * Creates a sparse embedding payload.
 *
 * @example
 * await updateDoc(docRef, {
 *   SPARSE_EMB: sparseVector(1000, [3, 40, 777], [0.5, 0.8, 0.33])
 * });
 *
 * @example
 * await addDoc(collection(db, "docs"), {
 *   title: "sparse vector doc",
 *   SPARSE_EMB: sparseVector(1000, [3, 40, 777], [0.5, 0.8, 0.33])
 * });
 */
export function sparseVector(
  dimension: number,
  indices: number[],
  values: number[]
): SparseEmbedding {
  validateSparseEmbedding({ type: "sparse", dimension, indices, values });
  return { type: "sparse", dimension, indices, values };
}

/**
 * Creates a sentinel that deletes an embedding key from `$embeddings` in v2.
 *
 * @example
 * await updateDoc(docRef, {
 *   LEGACY_EMB: deleteVector()
 * });
 */
export function deleteVector(): FieldValue {
  return new FieldValue("FieldValue:deleteVector", null);
}
