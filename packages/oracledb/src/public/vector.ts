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
