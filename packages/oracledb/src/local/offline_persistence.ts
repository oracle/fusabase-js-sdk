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

import {
  OfflineDeleteWrite,
  OfflinePatchWrite,
  OfflineSetWrite,
  OfflineWriteBatch,
  OfflineWriteMutation,
  OracledbDocumentKey,
  OracledbDocumentVersion,
  OracledbSnapshotVersion,
  OracledbWritePrecondition,
} from '../model/index.js';
import {
  OfflineCachedDocument,
  OfflineDocumentMutationIndex,
  OfflineDocumentOverlay,
  OfflinePersistence,
  OfflineQueryTarget,
  OfflineTargetDocument,
  OfflineTargetGlobals,
} from './types.js';
import { FieldValue } from '../field/value.js';

const TARGET_GLOBALS_KEY = 'target_global_metadata';
const KEY_SEPARATOR = '\u0001';

type PersistenceSnapshot = {
  remoteDocuments: Map<string, OfflineCachedDocument>;
  mutationBatches: Map<number, OfflineWriteBatch>;
  documentMutations: Map<string, null>;
  documentOverlays: Map<string, OfflineDocumentOverlay>;
  targets: Map<number, OfflineQueryTarget>;
  targetDocuments: Map<string, OfflineTargetDocument | null>;
  targetGlobals: OfflineTargetGlobals;
  nextBatchId: number;
  nextSequenceNumber: number;
};

type IndexedDbWrite = {
  storeName: string;
  operation: (store: IDBObjectStore) => IDBRequest<any> | void;
};

export function overlayKey(userId: string, documentPath: string): string {
  return `${userId}${KEY_SEPARATOR}${documentPath}`;
}

export function documentMutationKey(userId: string, documentPath: string, batchId: number): string {
  return `${userId}${KEY_SEPARATOR}${documentPath}${KEY_SEPARATOR}${batchId}`;
}

export function targetDocumentKey(targetId: number, documentPath: string): string {
  return `${targetId}${KEY_SEPARATOR}${documentPath}`;
}

function emptyTargetGlobals(): OfflineTargetGlobals {
  return {
    highestTargetId: 0,
  };
}

function resolveDocumentState(record: { data?: unknown; documentState?: unknown }): 'found' | 'noDocument' {
  if (record.documentState === 'noDocument') return 'noDocument';
  return record.data == null ? 'noDocument' : 'found';
}

export class OfflineMemoryPersistence implements OfflinePersistence {
  readonly kind = 'memory' as const;
  readonly remoteDocuments = new Map<string, OfflineCachedDocument>();
  readonly documents = this.remoteDocuments;
  readonly mutationBatches = new Map<number, OfflineWriteBatch>();
  readonly documentOverlays = new Map<string, OfflineDocumentOverlay>();
  readonly documentMutations = new Map<string, null>();
  readonly targets = new Map<number, OfflineQueryTarget>();
  readonly targetDocuments = new Map<string, OfflineTargetDocument | null>();
  targetGlobals: OfflineTargetGlobals = emptyTargetGlobals();
  nextBatchId = 1;
  nextSequenceNumber = 1;

  constructor(readonly cacheSizeBytes?: number) {}

  async start(): Promise<void> {}
  async shutdown(): Promise<void> {}
  async refreshFromStorage(): Promise<void> {}

  async runTransaction<T>(operation: () => Promise<T>): Promise<T> {
    const snapshot = capturePersistenceSnapshot(this);
    try {
      return await operation();
    } catch (error) {
      restorePersistenceSnapshot(this, snapshot);
      throw error;
    }
  }

  async clear(): Promise<void> {
    this.remoteDocuments.clear();
    this.mutationBatches.clear();
    this.documentOverlays.clear();
    this.documentMutations.clear();
    this.targets.clear();
    this.targetDocuments.clear();
    this.targetGlobals = emptyTargetGlobals();
    this.nextBatchId = 1;
    this.nextSequenceNumber = 1;
  }

  async setRemoteDocument(document: OfflineCachedDocument): Promise<void> {
    this.remoteDocuments.set(document.key.path, {
      ...document,
      documentState: document.documentState ?? (document.data == null ? 'noDocument' : 'found'),
      sequenceNumber: document.sequenceNumber ?? this.nextSequenceNumber++,
    });
    await this.collectGarbage();
  }

  async removeRemoteDocument(key: OracledbDocumentKey): Promise<void> {
    this.remoteDocuments.delete(key.path);
  }

  async setDocument(document: OfflineCachedDocument): Promise<void> {
    await this.setRemoteDocument(document);
  }

  async removeDocument(key: OracledbDocumentKey): Promise<void> {
    await this.removeRemoteDocument(key);
  }

  async setMutationBatch(batch: OfflineWriteBatch): Promise<void> {
    this.mutationBatches.set(batch.batchId, batch);
  }

  async removeMutationBatch(batchId: number): Promise<void> {
    this.mutationBatches.delete(batchId);
  }

  async setDocumentOverlay(overlay: OfflineDocumentOverlay): Promise<void> {
    this.documentOverlays.set(overlayKey(overlay.userId, overlay.path), overlay);
  }

  async removeDocumentOverlay(userId: string, documentPath: string): Promise<void> {
    this.documentOverlays.delete(overlayKey(userId, documentPath));
  }

  async setDocumentMutation(index: OfflineDocumentMutationIndex): Promise<void> {
    this.documentMutations.set(documentMutationKey(index.userId, index.documentPath, index.batchId), null);
  }

  async removeDocumentMutation(userId: string, documentPath: string, batchId: number): Promise<void> {
    this.documentMutations.delete(documentMutationKey(userId, documentPath, batchId));
  }

  async setTarget(target: OfflineQueryTarget): Promise<void> {
    this.targets.set(target.targetId, target);
  }

  async removeTarget(targetId: number): Promise<void> {
    this.targets.delete(targetId);
    for (const key of [...this.targetDocuments.keys()]) {
      if (key.startsWith(`${targetId}${KEY_SEPARATOR}`)) {
        this.targetDocuments.delete(key);
      }
    }
  }

  async setTargetDocument(targetDocument: OfflineTargetDocument): Promise<void> {
    this.targetDocuments.set(targetDocumentKey(targetDocument.targetId, targetDocument.documentPath), targetDocument);
  }

  async removeTargetDocument(targetId: number, documentPath: string): Promise<void> {
    this.targetDocuments.delete(targetDocumentKey(targetId, documentPath));
  }

  async setTargetGlobals(globals: OfflineTargetGlobals): Promise<void> {
    this.targetGlobals = globals;
  }

  async collectGarbage(): Promise<void> {
    collectGarbageFromMap(this.remoteDocuments, this.cacheSizeBytes, this.localMutationDocumentPaths());
  }

  private localMutationDocumentPaths(): Set<string> {
    return localMutationDocumentPaths(this.documentMutations, this.documentOverlays);
  }
}

export class OfflineIndexedDbPersistence implements OfflinePersistence {
  readonly kind = 'indexeddb' as const;
  readonly remoteDocuments = new Map<string, OfflineCachedDocument>();
  readonly documents = this.remoteDocuments;
  readonly mutationBatches = new Map<number, OfflineWriteBatch>();
  readonly documentOverlays = new Map<string, OfflineDocumentOverlay>();
  readonly documentMutations = new Map<string, null>();
  readonly targets = new Map<number, OfflineQueryTarget>();
  readonly targetDocuments = new Map<string, OfflineTargetDocument | null>();
  targetGlobals: OfflineTargetGlobals = emptyTargetGlobals();
  nextBatchId = 1;
  nextSequenceNumber = 1;
  private db: IDBDatabase | null = null;
  private readonly remoteDocumentsStoreName = 'remote_documents';
  private readonly legacyDocumentsStoreName = 'documents';
  private readonly mutationsStoreName = 'mutations';
  private readonly documentMutationsStoreName = 'document_mutations';
  private readonly documentOverlaysStoreName = 'document_overlays';
  private readonly targetsStoreName = 'targets';
  private readonly targetDocumentsStoreName = 'target_documents';
  private readonly targetGlobalsStoreName = 'target_globals';
  private activeWriteTransaction: IndexedDbWrite[] | null = null;
  private transactionQueue: Promise<void> = Promise.resolve();

  constructor(readonly databaseName: string, readonly cacheSizeBytes?: number) {}

  async start(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB persistence is not available in this environment');
    }
    this.db = await this.openDatabase();
    await this.loadRemoteDocuments();
    await this.loadMutationBatches();
    await this.loadDocumentMutations();
    await this.loadDocumentOverlays();
    await this.loadTargets();
    await this.loadTargetDocuments();
    await this.loadTargetGlobals();
  }

  async refreshFromStorage(): Promise<void> {
    if (!this.db) return;
    restorePersistenceSnapshot(this, await this.loadSnapshotFromStorage(this.db));
  }

  async runTransaction<T>(operation: () => Promise<T>): Promise<T> {
    if (this.activeWriteTransaction) {
      return operation();
    }

    const previous = this.transactionQueue.catch(() => undefined);
    let releaseCurrent!: () => void;
    const current = new Promise<void>(resolve => {
      releaseCurrent = resolve;
    });
    this.transactionQueue = previous.then(() => current);
    await previous;

    const snapshot = capturePersistenceSnapshot(this);
    const writes: IndexedDbWrite[] = [];
    this.activeWriteTransaction = writes;
    try {
      const result = await operation();
      this.activeWriteTransaction = null;
      await this.withDb(db => this.commitQueuedWrites(db, writes));
      return result;
    } catch (error) {
      this.activeWriteTransaction = null;
      restorePersistenceSnapshot(this, snapshot);
      throw error;
    } finally {
      releaseCurrent();
    }
  }

  async shutdown(): Promise<void> {
    this.db?.close();
    this.db = null;
  }

  async clear(): Promise<void> {
    const snapshot = capturePersistenceSnapshot(this);
    this.remoteDocuments.clear();
    this.mutationBatches.clear();
    this.documentMutations.clear();
    this.documentOverlays.clear();
    this.targets.clear();
    this.targetDocuments.clear();
    this.targetGlobals = emptyTargetGlobals();
    this.nextBatchId = 1;
    this.nextSequenceNumber = 1;
    if (typeof indexedDB === 'undefined') return;
    const db = this.db ?? await this.openDatabase();
    try {
      await this.commitQueuedWrites(
        db,
        this.storeNames(db).map(storeName => ({
          storeName,
          operation: store => store.clear(),
        }))
      );
    } catch (error) {
      restorePersistenceSnapshot(this, snapshot);
      throw error;
    } finally {
      if (!this.db) db.close();
    }
  }

  async setRemoteDocument(document: OfflineCachedDocument): Promise<void> {
    await this.runWriteOperation(async () => {
      const sequencedDocument = {
        ...document,
        documentState: document.documentState ?? (document.data == null ? 'noDocument' : 'found'),
        sequenceNumber: document.sequenceNumber ?? this.nextSequenceNumber++,
      };
      this.remoteDocuments.set(sequencedDocument.key.path, sequencedDocument);
      await this.queueWrite(this.remoteDocumentsStoreName, store =>
        store.put(this.serializeDocument(sequencedDocument))
      );
      await this.collectGarbage();
    });
  }

  async removeRemoteDocument(key: OracledbDocumentKey): Promise<void> {
    await this.runWriteOperation(async () => {
      this.remoteDocuments.delete(key.path);
      await this.queueWrite(this.remoteDocumentsStoreName, store => store.delete(key.path));
    });
  }

  async setDocument(document: OfflineCachedDocument): Promise<void> {
    await this.setRemoteDocument(document);
  }

  async removeDocument(key: OracledbDocumentKey): Promise<void> {
    await this.removeRemoteDocument(key);
  }

  async collectGarbage(): Promise<void> {
    await this.runWriteOperation(async () => {
      const removedKeys = collectGarbageFromMap(this.remoteDocuments, this.cacheSizeBytes, this.localMutationDocumentPaths());
      if (removedKeys.length === 0) return;
      await Promise.all(removedKeys.map(key =>
        this.queueWrite(this.remoteDocumentsStoreName, store => store.delete(key))
      ));
    });
  }

  private localMutationDocumentPaths(): Set<string> {
    return localMutationDocumentPaths(this.documentMutations, this.documentOverlays);
  }

  async setMutationBatch(batch: OfflineWriteBatch): Promise<void> {
    await this.runWriteOperation(async () => {
      this.mutationBatches.set(batch.batchId, batch);
      await this.queueWrite(this.mutationsStoreName, store =>
        store.put(this.serializeMutationBatch(batch))
      );
    });
  }

  async removeMutationBatch(batchId: number, userId = 'anonymous'): Promise<void> {
    await this.runWriteOperation(async () => {
      this.mutationBatches.delete(batchId);
      await this.queueWrite(this.mutationsStoreName, store => store.delete([userId, batchId]));
    });
  }

  async setDocumentOverlay(overlay: OfflineDocumentOverlay): Promise<void> {
    await this.runWriteOperation(async () => {
      this.documentOverlays.set(overlayKey(overlay.userId, overlay.path), overlay);
      await this.queueWrite(this.documentOverlaysStoreName, store =>
        store.put(this.serializeOverlay(overlay))
      );
    });
  }

  async removeDocumentOverlay(userId: string, documentPath: string): Promise<void> {
    await this.runWriteOperation(async () => {
      this.documentOverlays.delete(overlayKey(userId, documentPath));
      await this.queueWrite(this.documentOverlaysStoreName, store => store.delete([userId, documentPath]));
    });
  }

  async setDocumentMutation(index: OfflineDocumentMutationIndex): Promise<void> {
    await this.runWriteOperation(async () => {
      this.documentMutations.set(documentMutationKey(index.userId, index.documentPath, index.batchId), null);
      await this.queueWrite(this.documentMutationsStoreName, store => store.put(index));
    });
  }

  async removeDocumentMutation(userId: string, documentPath: string, batchId: number): Promise<void> {
    await this.runWriteOperation(async () => {
      this.documentMutations.delete(documentMutationKey(userId, documentPath, batchId));
      await this.queueWrite(this.documentMutationsStoreName, store => store.delete([userId, documentPath, batchId]));
    });
  }

  async setTarget(target: OfflineQueryTarget): Promise<void> {
    await this.runWriteOperation(async () => {
      this.targets.set(target.targetId, target);
      await this.queueWrite(this.targetsStoreName, store => store.put(this.serializeTarget(target)));
    });
  }

  async removeTarget(targetId: number): Promise<void> {
    await this.runWriteOperation(async () => {
      this.targets.delete(targetId);
      const documentPathsToRemove: string[] = [];
      for (const key of [...this.targetDocuments.keys()]) {
        if (key.startsWith(`${targetId}${KEY_SEPARATOR}`)) {
          const targetDocument = this.targetDocuments.get(key);
          if (targetDocument) {
            documentPathsToRemove.push(targetDocument.documentPath);
          }
          this.targetDocuments.delete(key);
        }
      }
      await this.queueWrite(this.targetsStoreName, store => store.delete(targetId));
      await Promise.all(documentPathsToRemove.map(documentPath =>
        this.queueWrite(this.targetDocumentsStoreName, store => store.delete([targetId, documentPath]))
      ));
    });
  }

  async setTargetDocument(targetDocument: OfflineTargetDocument): Promise<void> {
    await this.runWriteOperation(async () => {
      this.targetDocuments.set(targetDocumentKey(targetDocument.targetId, targetDocument.documentPath), targetDocument);
      await this.queueWrite(this.targetDocumentsStoreName, store => store.put(targetDocument));
    });
  }

  async removeTargetDocument(targetId: number, documentPath: string): Promise<void> {
    await this.runWriteOperation(async () => {
      this.targetDocuments.delete(targetDocumentKey(targetId, documentPath));
      await this.queueWrite(this.targetDocumentsStoreName, store => store.delete([targetId, documentPath]));
    });
  }

  async setTargetGlobals(globals: OfflineTargetGlobals): Promise<void> {
    await this.runWriteOperation(async () => {
      this.targetGlobals = globals;
      await this.queueWrite(this.targetGlobalsStoreName, store =>
        store.put({
          key: TARGET_GLOBALS_KEY,
          ...this.serializeTargetGlobals(globals),
        })
      );
    });
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.legacyDocumentsStoreName)) {
          db.createObjectStore(this.legacyDocumentsStoreName, { keyPath: 'path' });
        }
        if (!db.objectStoreNames.contains(this.remoteDocumentsStoreName)) {
          db.createObjectStore(this.remoteDocumentsStoreName, { keyPath: 'path' });
        }
        if (db.objectStoreNames.contains(this.mutationsStoreName)) {
          const transaction = request.transaction;
          const existingStore = transaction?.objectStore(this.mutationsStoreName);
          const keyPath = existingStore?.keyPath;
          const usesCompositeKey = Array.isArray(keyPath) &&
            keyPath[0] === 'userId' &&
            keyPath[1] === 'batchId';
          if (!usesCompositeKey && existingStore) {
            const oldMutationsRequest = existingStore.getAll();
            oldMutationsRequest.onsuccess = () => {
              const oldRecords = oldMutationsRequest.result ?? [];
              db.deleteObjectStore(this.mutationsStoreName);
              const newStore = db.createObjectStore(this.mutationsStoreName, { keyPath: ['userId', 'batchId'] });
              for (const record of oldRecords) {
                newStore.put({
                  ...record,
                  userId: record.userId ?? 'anonymous',
                });
              }
            };
          }
        } else {
          db.createObjectStore(this.mutationsStoreName, { keyPath: ['userId', 'batchId'] });
        }
        if (!db.objectStoreNames.contains(this.documentMutationsStoreName)) {
          db.createObjectStore(this.documentMutationsStoreName, { keyPath: ['userId', 'documentPath', 'batchId'] });
        }
        if (!db.objectStoreNames.contains(this.documentOverlaysStoreName)) {
          db.createObjectStore(this.documentOverlaysStoreName, { keyPath: ['userId', 'path'] });
        }
        if (!db.objectStoreNames.contains(this.targetsStoreName)) {
          db.createObjectStore(this.targetsStoreName, { keyPath: 'targetId' });
        }
        if (!db.objectStoreNames.contains(this.targetDocumentsStoreName)) {
          db.createObjectStore(this.targetDocumentsStoreName, { keyPath: ['targetId', 'documentPath'] });
        }
        if (!db.objectStoreNames.contains(this.targetGlobalsStoreName)) {
          db.createObjectStore(this.targetGlobalsStoreName, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB persistence'));
      request.onblocked = () => reject(new Error('IndexedDB persistence is blocked by another connection'));
    });
  }

  private async loadRemoteDocuments(): Promise<void> {
    if (!this.db) return;
    const records = await this.runStoreRequest<any[]>(this.db, this.remoteDocumentsStoreName, 'readonly', store => store.getAll());
    this.remoteDocuments.clear();
    for (const record of records) {
      const document = this.deserializeDocument(record);
      this.remoteDocuments.set(document.key.path, document);
      this.nextSequenceNumber = Math.max(this.nextSequenceNumber, (document.sequenceNumber ?? 0) + 1);
    }
    if (records.length === 0 && this.db.objectStoreNames.contains(this.legacyDocumentsStoreName)) {
      const legacyRecords = await this.runStoreRequest<any[]>(this.db, this.legacyDocumentsStoreName, 'readonly', store => store.getAll());
      for (const record of legacyRecords) {
        const document = this.deserializeDocument(record);
        this.remoteDocuments.set(document.key.path, document);
      }
    }
  }

  private async loadMutationBatches(): Promise<void> {
    if (!this.db) return;
    const records = await this.runStoreRequest<any[]>(this.db, this.mutationsStoreName, 'readonly', store => store.getAll());
    this.mutationBatches.clear();
    let maxBatchId = 0;
    for (const record of records) {
      const batch = this.deserializeMutationBatch(record);
      this.mutationBatches.set(batch.batchId, batch);
      maxBatchId = Math.max(maxBatchId, batch.batchId);
    }
    this.nextBatchId = maxBatchId + 1;
  }

  private async loadDocumentMutations(): Promise<void> {
    if (!this.db) return;
    const records = await this.runStoreRequest<any[]>(this.db, this.documentMutationsStoreName, 'readonly', store => store.getAll());
    this.documentMutations.clear();
    for (const record of records) {
      this.documentMutations.set(documentMutationKey(record.userId, record.documentPath, record.batchId), null);
    }
  }

  private async loadDocumentOverlays(): Promise<void> {
    if (!this.db) return;
    const records = await this.runStoreRequest<any[]>(this.db, this.documentOverlaysStoreName, 'readonly', store => store.getAll());
    this.documentOverlays.clear();
    for (const record of records) {
      const overlay = this.deserializeOverlay(record);
      this.documentOverlays.set(overlayKey(overlay.userId, overlay.path), overlay);
    }
  }

  private async loadTargets(): Promise<void> {
    if (!this.db) return;
    const records = await this.runStoreRequest<any[]>(this.db, this.targetsStoreName, 'readonly', store => store.getAll());
    this.targets.clear();
    for (const record of records) {
      const target = this.deserializeTarget(record);
      this.targets.set(target.targetId, target);
      this.targetGlobals.highestTargetId = Math.max(this.targetGlobals.highestTargetId, target.targetId);
    }
  }

  private async loadTargetDocuments(): Promise<void> {
    if (!this.db) return;
    const records = await this.runStoreRequest<any[]>(this.db, this.targetDocumentsStoreName, 'readonly', store => store.getAll());
    this.targetDocuments.clear();
    for (const record of records) {
      this.targetDocuments.set(targetDocumentKey(record.targetId, record.documentPath), record);
    }
  }

  private async loadTargetGlobals(): Promise<void> {
    if (!this.db) return;
    const records = await this.runStoreRequest<any[]>(this.db, this.targetGlobalsStoreName, 'readonly', store => store.getAll());
    const record = records.find(item => item.key === TARGET_GLOBALS_KEY);
    if (record) {
      this.targetGlobals = this.deserializeTargetGlobals(record);
    }
  }

  private runStoreRequest<T>(
    db: IDBDatabase,
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB operation failed'));
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    });
  }

  private runWriteOperation<T>(operation: () => Promise<T>): Promise<T> {
    return this.activeWriteTransaction
      ? operation()
      : this.runTransaction(operation);
  }

  private async queueWrite(
    storeName: string,
    operation: (store: IDBObjectStore) => IDBRequest<any> | void
  ): Promise<void> {
    if (this.activeWriteTransaction) {
      this.activeWriteTransaction.push({ storeName, operation });
      return;
    }
    await this.withDb(db => this.commitQueuedWrites(db, [{ storeName, operation }]));
  }

  private commitQueuedWrites(db: IDBDatabase, writes: IndexedDbWrite[]): Promise<void> {
    if (writes.length === 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const storeNames = [...new Set(writes.map(write => write.storeName))]
        .filter(storeName => db.objectStoreNames.contains(storeName));
      if (storeNames.length === 0) {
        resolve();
        return;
      }
      const transaction = db.transaction(storeNames, 'readwrite');
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        try {
          transaction.abort();
        } catch {
          // Ignore abort errors when IndexedDB has already aborted the transaction.
        }
        reject(error);
      };
      transaction.oncomplete = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      transaction.onerror = () => fail(transaction.error ?? new Error('IndexedDB transaction failed'));
      transaction.onabort = () => fail(transaction.error ?? new Error('IndexedDB transaction aborted'));
      try {
        for (const write of writes) {
          if (!db.objectStoreNames.contains(write.storeName)) continue;
          const request = write.operation(transaction.objectStore(write.storeName));
          if (request) {
            request.onerror = () => fail(request.error ?? new Error('IndexedDB operation failed'));
          }
        }
      } catch (error) {
        fail(error);
      }
    });
  }

  private async withDb<T>(operation: (db: IDBDatabase) => Promise<T>): Promise<T> {
    if (!this.db) {
      throw new Error('IndexedDB persistence has not been started');
    }
    return operation(this.db);
  }

  private storeNames(db: IDBDatabase): string[] {
    return [
      this.remoteDocumentsStoreName,
      this.mutationsStoreName,
      this.documentMutationsStoreName,
      this.documentOverlaysStoreName,
      this.targetsStoreName,
      this.targetDocumentsStoreName,
      this.targetGlobalsStoreName,
    ].filter(storeName => db.objectStoreNames.contains(storeName));
  }

  private loadSnapshotFromStorage(db: IDBDatabase): Promise<PersistenceSnapshot> {
    return new Promise((resolve, reject) => {
      const storeNames = [...new Set([...this.storeNames(db), this.legacyDocumentsStoreName])]
        .filter(storeName => db.objectStoreNames.contains(storeName));
      if (storeNames.length === 0) {
        resolve({
          remoteDocuments: new Map(),
          mutationBatches: new Map(),
          documentMutations: new Map(),
          documentOverlays: new Map(),
          targets: new Map(),
          targetDocuments: new Map(),
          targetGlobals: emptyTargetGlobals(),
          nextBatchId: 1,
          nextSequenceNumber: 1,
        });
        return;
      }

      const transaction = db.transaction(storeNames, 'readonly');
      const reads = new Map<string, any[]>();
      let pending = storeNames.length;
      let settled = false;

      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      transaction.onerror = () => fail(transaction.error ?? new Error('IndexedDB transaction failed'));
      transaction.onabort = () => fail(transaction.error ?? new Error('IndexedDB transaction aborted'));

      for (const storeName of storeNames) {
        const request = transaction.objectStore(storeName).getAll();
        request.onsuccess = () => {
          reads.set(storeName, request.result ?? []);
          pending -= 1;
          if (pending === 0 && !settled) {
            settled = true;
            resolve(this.buildSnapshotFromRecords(db, reads));
          }
        };
        request.onerror = () => fail(request.error ?? new Error('IndexedDB operation failed'));
      }
    });
  }

  private buildSnapshotFromRecords(db: IDBDatabase, reads: Map<string, any[]>): PersistenceSnapshot {
    const remoteDocuments = new Map<string, OfflineCachedDocument>();
    const mutationBatches = new Map<number, OfflineWriteBatch>();
    const documentMutations = new Map<string, null>();
    const documentOverlays = new Map<string, OfflineDocumentOverlay>();
    const targets = new Map<number, OfflineQueryTarget>();
    const targetDocuments = new Map<string, OfflineTargetDocument | null>();
    let targetGlobals = emptyTargetGlobals();
    let nextBatchId = 1;
    let nextSequenceNumber = 1;

    const remoteRecords = reads.get(this.remoteDocumentsStoreName) ?? [];
    for (const record of remoteRecords) {
      const document = this.deserializeDocument(record);
      remoteDocuments.set(document.key.path, document);
      nextSequenceNumber = Math.max(nextSequenceNumber, (document.sequenceNumber ?? 0) + 1);
    }

    if (remoteRecords.length === 0 && db.objectStoreNames.contains(this.legacyDocumentsStoreName)) {
      for (const record of reads.get(this.legacyDocumentsStoreName) ?? []) {
        const document = this.deserializeDocument(record);
        remoteDocuments.set(document.key.path, document);
      }
    }

    let maxBatchId = 0;
    for (const record of reads.get(this.mutationsStoreName) ?? []) {
      const batch = this.deserializeMutationBatch(record);
      mutationBatches.set(batch.batchId, batch);
      maxBatchId = Math.max(maxBatchId, batch.batchId);
    }
    nextBatchId = maxBatchId + 1;

    for (const record of reads.get(this.documentMutationsStoreName) ?? []) {
      documentMutations.set(documentMutationKey(record.userId, record.documentPath, record.batchId), null);
    }

    for (const record of reads.get(this.documentOverlaysStoreName) ?? []) {
      const overlay = this.deserializeOverlay(record);
      documentOverlays.set(overlayKey(overlay.userId, overlay.path), overlay);
    }

    for (const record of reads.get(this.targetsStoreName) ?? []) {
      const target = this.deserializeTarget(record);
      targets.set(target.targetId, target);
      targetGlobals.highestTargetId = Math.max(targetGlobals.highestTargetId, target.targetId);
    }

    for (const record of reads.get(this.targetDocumentsStoreName) ?? []) {
      targetDocuments.set(targetDocumentKey(record.targetId, record.documentPath), record);
    }

    const targetGlobalRecord = (reads.get(this.targetGlobalsStoreName) ?? [])
      .find(record => record.key === TARGET_GLOBALS_KEY);
    if (targetGlobalRecord) {
      targetGlobals = this.deserializeTargetGlobals(targetGlobalRecord);
    }

    return {
      remoteDocuments,
      mutationBatches,
      documentMutations,
      documentOverlays,
      targets,
      targetDocuments,
      targetGlobals,
      nextBatchId,
      nextSequenceNumber,
    };
  }

  private serializeDocument(document: OfflineCachedDocument): Record<string, unknown> {
    return {
      path: document.key.path,
      data: document.data,
      version: document.version.value,
      updateTime: document.updateTime,
      commitTime: document.commitTime,
      readTime: document.readTime,
      documentState: document.documentState ?? (document.data == null ? 'noDocument' : 'found'),
      hasLocalMutations: document.hasLocalMutations,
      hasCommittedMutations: document.hasCommittedMutations,
      sequenceNumber: document.sequenceNumber,
    };
  }

  private deserializeDocument(record: any): OfflineCachedDocument {
    return {
      key: OracledbDocumentKey.fromPath(record.path),
      data: record.data ?? null,
      version: new OracledbDocumentVersion(record.version ?? ''),
      updateTime: record.updateTime,
      commitTime: record.commitTime,
      readTime: record.readTime,
      documentState: resolveDocumentState(record),
      hasLocalMutations: Boolean(record.hasLocalMutations),
      hasCommittedMutations: Boolean(record.hasCommittedMutations),
      sequenceNumber: typeof record.sequenceNumber === 'number' ? record.sequenceNumber : undefined,
    };
  }

  private serializeOverlay(overlay: OfflineDocumentOverlay): Record<string, unknown> {
    return {
      userId: overlay.userId,
      path: overlay.path,
      data: overlay.data,
      documentState: overlay.documentState,
      largestBatchId: overlay.largestBatchId,
      hasLocalMutations: overlay.hasLocalMutations,
    };
  }

  private deserializeOverlay(record: any): OfflineDocumentOverlay {
    return {
      userId: record.userId ?? 'anonymous',
      path: record.path,
      key: OracledbDocumentKey.fromPath(record.path),
      data: record.data ?? null,
      documentState: resolveDocumentState(record),
      largestBatchId: record.largestBatchId ?? 0,
      hasLocalMutations: record.hasLocalMutations !== false,
    };
  }

  private serializeMutationBatch(batch: OfflineWriteBatch): Record<string, unknown> {
    return {
      batchId: batch.batchId,
      userId: batch.userId,
      localWriteTime: batch.localWriteTime,
      source: batch.source,
      mutations: batch.mutations.map(mutation => this.serializeMutation(mutation)),
      baseDocuments: batch.baseDocuments.map(document => document ? this.serializeDocument(document) : null),
      state: 'pending',
    };
  }

  private deserializeMutationBatch(record: any): OfflineWriteBatch {
    return new OfflineWriteBatch(
      record.batchId,
      record.localWriteTime,
      (record.mutations ?? []).map((mutation: any) => this.deserializeMutation(mutation)),
      (record.baseDocuments ?? []).map((document: any) => document ? this.deserializeDocument(document) : null),
      record.userId ?? 'anonymous',
      record.source ?? ((record.mutations?.length ?? 0) > 1 ? 'writeBatch' : 'individual')
    );
  }

  private serializeMutation(mutation: OfflineWriteMutation): Record<string, unknown> {
    return {
      type: mutation.type,
      key: mutation.key.path,
      path: mutation.key.path,
      precondition: {
        exists: mutation.precondition.exists,
      },
      data: this.serializeValue((mutation as any).data),
      fields: this.serializeValue((mutation as any).data),
      fieldMask: (mutation as any).fieldMask?.map((field: any) => String(field)),
      fieldTransforms: mutation.fieldTransforms,
    };
  }

  private deserializeMutation(record: any): OfflineWriteMutation {
    const precondition = typeof record.precondition?.exists === 'boolean'
      ? OracledbWritePrecondition.exists(record.precondition.exists)
      : OracledbWritePrecondition.none();
    const key = OracledbDocumentKey.fromPath(record.key ?? record.path);
    switch (record.type) {
      case 'set':
      case 'SetMutation':
        return new OfflineSetWrite(key, this.deserializeValue(record.data ?? record.fields ?? {}), precondition, record.fieldTransforms ?? []);
      case 'patch':
      case 'PatchMutation':
        return new OfflinePatchWrite(key, this.deserializeValue(record.data ?? record.fields ?? {}), record.fieldMask ?? [], precondition, record.fieldTransforms ?? []);
      case 'delete':
      case 'DeleteMutation':
        return new OfflineDeleteWrite(key, precondition, record.fieldTransforms ?? []);
      default:
        throw new Error(`Unsupported offline mutation type ${record.type}`);
    }
  }

  private serializeValue(value: any): any {
    if (value instanceof FieldValue) {
      return {
        __offlineType: 'FieldValue',
        operation: value.operation,
        value: this.serializeValue(value.value),
      };
    }
    if (Array.isArray(value)) {
      return value.map(item => this.serializeValue(item));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, this.serializeValue(child)])
      );
    }
    return value;
  }

  private deserializeValue(value: any): any {
    if (value?.__offlineType === 'FieldValue') {
      return new FieldValue(value.operation, this.deserializeValue(value.value));
    }
    if (Array.isArray(value)) {
      return value.map(item => this.deserializeValue(item));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, this.deserializeValue(child)])
      );
    }
    return value;
  }

  private serializeTarget(target: OfflineQueryTarget): Record<string, unknown> {
    return {
      targetId: target.targetId,
      canonicalQuery: target.canonicalQuery,
      canonicalId: target.canonicalId ?? target.canonicalQuery,
      targetType: target.targetType,
      path: target.path,
      userId: target.userId,
      filters: target.filters,
      orderBy: target.orderBy,
      limit: target.limit,
      snapshotVersion: target.snapshotVersion?.value,
      isActive: target.isActive,
    };
  }

  private deserializeTarget(record: any): OfflineQueryTarget {
    return {
      targetId: record.targetId,
      canonicalQuery: record.canonicalQuery ?? record.canonicalId,
      canonicalId: record.canonicalId ?? record.canonicalQuery,
      targetType: record.targetType,
      path: record.path,
      userId: record.userId,
      filters: record.filters,
      orderBy: record.orderBy,
      limit: record.limit,
      snapshotVersion: record.snapshotVersion ? new OracledbSnapshotVersion(record.snapshotVersion) : undefined,
      isActive: record.isActive,
    };
  }

  private serializeTargetGlobals(globals: OfflineTargetGlobals): Record<string, unknown> {
    return {
      ...globals,
      lastRemoteSnapshotVersion: globals.lastRemoteSnapshotVersion?.value,
    };
  }

  private deserializeTargetGlobals(record: any): OfflineTargetGlobals {
    return {
      highestTargetId: record.highestTargetId ?? 0,
      lastRemoteSnapshotVersion: record.lastRemoteSnapshotVersion
        ? new OracledbSnapshotVersion(record.lastRemoteSnapshotVersion)
        : undefined,
      activeTargetCount: record.activeTargetCount,
      currentUserId: record.currentUserId,
    };
  }
}

function capturePersistenceSnapshot(persistence: {
  remoteDocuments: Map<string, OfflineCachedDocument>;
  mutationBatches: Map<number, OfflineWriteBatch>;
  documentMutations: Map<string, null>;
  documentOverlays: Map<string, OfflineDocumentOverlay>;
  targets: Map<number, OfflineQueryTarget>;
  targetDocuments: Map<string, OfflineTargetDocument | null>;
  targetGlobals: OfflineTargetGlobals;
  nextBatchId: number;
  nextSequenceNumber: number;
}): PersistenceSnapshot {
  return {
    remoteDocuments: new Map(persistence.remoteDocuments),
    mutationBatches: new Map(persistence.mutationBatches),
    documentMutations: new Map(persistence.documentMutations),
    documentOverlays: new Map(persistence.documentOverlays),
    targets: new Map(persistence.targets),
    targetDocuments: new Map(persistence.targetDocuments),
    targetGlobals: { ...persistence.targetGlobals },
    nextBatchId: persistence.nextBatchId,
    nextSequenceNumber: persistence.nextSequenceNumber,
  };
}

function restorePersistenceSnapshot(
  persistence: {
    remoteDocuments: Map<string, OfflineCachedDocument>;
    mutationBatches: Map<number, OfflineWriteBatch>;
    documentMutations: Map<string, null>;
    documentOverlays: Map<string, OfflineDocumentOverlay>;
    targets: Map<number, OfflineQueryTarget>;
    targetDocuments: Map<string, OfflineTargetDocument | null>;
    targetGlobals: OfflineTargetGlobals;
    nextBatchId: number;
    nextSequenceNumber: number;
  },
  snapshot: PersistenceSnapshot
): void {
  persistence.remoteDocuments.clear();
  for (const [key, value] of snapshot.remoteDocuments) {
    persistence.remoteDocuments.set(key, value);
  }
  persistence.mutationBatches.clear();
  for (const [key, value] of snapshot.mutationBatches) {
    persistence.mutationBatches.set(key, value);
  }
  persistence.documentMutations.clear();
  for (const [key, value] of snapshot.documentMutations) {
    persistence.documentMutations.set(key, value);
  }
  persistence.documentOverlays.clear();
  for (const [key, value] of snapshot.documentOverlays) {
    persistence.documentOverlays.set(key, value);
  }
  persistence.targets.clear();
  for (const [key, value] of snapshot.targets) {
    persistence.targets.set(key, value);
  }
  persistence.targetDocuments.clear();
  for (const [key, value] of snapshot.targetDocuments) {
    persistence.targetDocuments.set(key, value);
  }
  persistence.targetGlobals = { ...snapshot.targetGlobals };
  persistence.nextBatchId = snapshot.nextBatchId;
  persistence.nextSequenceNumber = snapshot.nextSequenceNumber;
}

function collectGarbageFromMap(
  documents: Map<string, OfflineCachedDocument>,
  cacheSizeBytes?: number,
  protectedPaths: Set<string> = new Set()
): string[] {
  if (!cacheSizeBytes || cacheSizeBytes <= 0) return [];
  const removedKeys: string[] = [];
  let currentSize = estimateCacheSize(documents);
  if (currentSize <= cacheSizeBytes) return removedKeys;
  const candidates = [...documents.entries()]
    .filter(([key, document]) => !document.hasLocalMutations && !protectedPaths.has(key))
    .sort(([, left], [, right]) => (left.sequenceNumber ?? 0) - (right.sequenceNumber ?? 0));
  for (const [key, document] of candidates) {
    if (currentSize <= cacheSizeBytes) break;
    documents.delete(key);
    removedKeys.push(key);
    currentSize -= estimateDocumentSize(document);
  }
  return removedKeys;
}

function localMutationDocumentPaths(
  documentMutations: Map<string, null>,
  documentOverlays: Map<string, OfflineDocumentOverlay>
): Set<string> {
  const paths = new Set<string>();
  for (const key of documentMutations.keys()) {
    const parts = key.split(KEY_SEPARATOR);
    if (parts.length >= 3) {
      paths.add(parts.slice(1, -1).join(KEY_SEPARATOR));
    }
  }
  for (const overlay of documentOverlays.values()) {
    paths.add(overlay.path);
  }
  return paths;
}

function estimateCacheSize(documents: Map<string, OfflineCachedDocument>): number {
  let size = 0;
  for (const document of documents.values()) {
    size += estimateDocumentSize(document);
  }
  return size;
}

function estimateDocumentSize(document: OfflineCachedDocument): number {
  return JSON.stringify({
    path: document.key.path,
    data: document.data,
    version: document.version.value,
    updateTime: document.updateTime,
    commitTime: document.commitTime,
    readTime: document.readTime,
  }).length;
}
