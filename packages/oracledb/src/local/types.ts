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
import { OracledbDocumentKey, OracledbDocumentVersion, OfflineWriteBatch, OracledbSnapshotVersion } from '../model/index.js';

export type PersistenceKind = 'indexeddb' | 'memory';

export type OfflineOptions = {
  persistence?: PersistenceKind;
  synchronizeTabs?: boolean;
  cacheSizeBytes?: number;
};

export type OfflineCachedDocument = {
  key: OracledbDocumentKey;
  data: DocumentData | null;
  version: OracledbDocumentVersion;
  updateTime?: string;
  commitTime?: string;
  readTime?: string;
  documentState?: 'found' | 'noDocument';
  hasLocalMutations: boolean;
  hasCommittedMutations: boolean;
  sequenceNumber?: number;
};

export type OfflineQueryTarget = {
  targetId: number;
  canonicalQuery: string;
  canonicalId?: string;
  targetType?: 'document' | 'query';
  path?: string;
  userId?: string;
  filters?: Array<{ field: string | null; op: string; value: unknown }>;
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  limit?: number | null;
  snapshotVersion?: OracledbSnapshotVersion;
  isActive?: boolean;
};

export type OfflineDocumentOverlay = {
  userId: string;
  path: string;
  key: OracledbDocumentKey;
  largestBatchId: number;
  data: DocumentData | null;
  documentState: 'found' | 'noDocument';
  hasLocalMutations: boolean;
};

export type OfflineDocumentMutationIndex = {
  userId: string;
  documentPath: string;
  batchId: number;
};

export type OfflineTargetDocument = {
  targetId: number;
  documentPath: string;
  readTime?: string;
};

export type OfflineTargetGlobals = {
  highestTargetId: number;
  lastRemoteSnapshotVersion?: OracledbSnapshotVersion;
  activeTargetCount?: number;
  currentUserId?: string;
};

export type OfflineLocalWriteResult = {
  batchId: number;
  affectedKeys: OracledbDocumentKey[];
};

export type OfflineRejectedWriteResult = {
  affectedKeys: OracledbDocumentKey[];
  rejectedBatchIds: number[];
};

export interface OfflinePersistence {
  readonly kind: PersistenceKind;
  start(): Promise<void>;
  shutdown(): Promise<void>;
  clear(): Promise<void>;
  refreshFromStorage?(): Promise<void>;
  runTransaction?<T>(operation: () => Promise<T>): Promise<T>;
  remoteDocuments: Map<string, OfflineCachedDocument>;
  documents: Map<string, OfflineCachedDocument>;
  mutationBatches: Map<number, OfflineWriteBatch>;
  documentOverlays: Map<string, OfflineDocumentOverlay>;
  documentMutations: Map<string, null>;
  targets: Map<number, OfflineQueryTarget>;
  targetDocuments: Map<string, OfflineTargetDocument | null>;
  targetGlobals: OfflineTargetGlobals;
  nextBatchId: number;
  nextSequenceNumber: number;
  cacheSizeBytes?: number;
  setRemoteDocument?(document: OfflineCachedDocument): Promise<void>;
  removeRemoteDocument?(key: OracledbDocumentKey): Promise<void>;
  setDocument?(document: OfflineCachedDocument): Promise<void>;
  removeDocument?(key: OracledbDocumentKey): Promise<void>;
  setMutationBatch?(batch: OfflineWriteBatch): Promise<void>;
  removeMutationBatch?(batchId: number, userId?: string): Promise<void>;
  setDocumentOverlay?(overlay: OfflineDocumentOverlay): Promise<void>;
  removeDocumentOverlay?(userId: string, documentPath: string): Promise<void>;
  setDocumentMutation?(index: OfflineDocumentMutationIndex): Promise<void>;
  removeDocumentMutation?(userId: string, documentPath: string, batchId: number): Promise<void>;
  setTarget?(target: OfflineQueryTarget): Promise<void>;
  removeTarget?(targetId: number): Promise<void>;
  setTargetDocument?(targetDocument: OfflineTargetDocument): Promise<void>;
  removeTargetDocument?(targetId: number, documentPath: string): Promise<void>;
  setTargetGlobals?(globals: OfflineTargetGlobals): Promise<void>;
  collectGarbage?(): Promise<void>;
}

export interface OfflineDocumentCacheContract {
  getDocument(key: OracledbDocumentKey): Promise<OfflineCachedDocument | null>;
  getDocumentsMatchingPrefix(pathPrefix: string): Promise<OfflineCachedDocument[]>;
  setDocument(document: OfflineCachedDocument): Promise<void>;
  removeDocument(key: OracledbDocumentKey): Promise<void>;
}

export interface OfflineMutationQueueContract {
  addMutationBatch(batch: OfflineWriteBatch): Promise<void>;
  getAllMutationBatches(): Promise<OfflineWriteBatch[]>;
  removeMutationBatch(batchId: number): Promise<void>;
}
