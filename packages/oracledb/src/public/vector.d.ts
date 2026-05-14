import { FieldValue } from "../field/value.js";
import { DenseEmbedding, SparseEmbedding } from "../types/vector.js";

export declare function denseVector(values: number[]): DenseEmbedding;
export declare function sparseVector(
  dimension: number,
  indices: number[],
  values: number[]
): SparseEmbedding;
export declare function deleteVector(): FieldValue;
