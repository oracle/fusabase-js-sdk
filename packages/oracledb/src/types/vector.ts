import { FieldValue } from "../field/value.js";

export type DenseEmbedding = { type: "dense"; values: number[] };
export type DenseEmbeddingShorthand = number[];
export type SparseEmbedding = {
  type: "sparse";
  dimension: number;
  indices: number[];
  values: number[];
};

export type EmbeddingInput = DenseEmbedding | SparseEmbedding | DenseEmbeddingShorthand;
export type EmbeddingsMap = Record<string, EmbeddingInput>;

export type VectorMetric = "COSINE" | "EUCLIDEAN" | "DOT";
export type VectorSearchDenseQuery = { vector: number[]; sparse?: never };
export type VectorSearchSparseQuery = { sparse: SparseEmbedding; vector?: never };
export type VectorSearchQuery = VectorSearchDenseQuery | VectorSearchSparseQuery;

export interface VectorSearch {
  field: string;
  query: VectorSearchQuery;
  metric?: VectorMetric;
  topK?: number;
  threshold?: number;
}

export interface V2UpdateOperationBase {
  field: string;
  op: string;
  value: unknown;
  valueType?: string;
}

export interface V2EmbeddingsSetOperation {
  op: "set";
  field: "$embeddings";
  value: EmbeddingsMap;
  valueType?: "mapValue" | string;
}

export interface V2EmbeddingsDeleteOperation {
  op: "delete";
  field: "$embeddings";
  value: string[];
  valueType?: "arrayValue" | string;
}

export type V2UpdateOperation =
  | V2UpdateOperationBase
  | V2EmbeddingsSetOperation
  | V2EmbeddingsDeleteOperation;

export type DeleteVectorSentinel = FieldValue;
export type VectorSentinel = DenseEmbedding | SparseEmbedding | DeleteVectorSentinel;
