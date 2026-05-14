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
