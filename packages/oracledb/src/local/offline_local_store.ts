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
  OfflineWriteBatchSource,
  OfflineWriteMutation,
  OracledbDocumentKey,
  OracledbDocumentVersion,
  OracledbSnapshotVersion,
} from '../model/index.js';
import { FieldValue } from '../field/value.js';
import { OfflineMutationQueue } from './offline_mutation_queue.js';
import {
  OfflineCachedDocument,
  OfflineDocumentOverlay,
  OfflineLocalWriteResult,
  OfflinePersistence,
  OfflineQueryTarget,
  OfflineRejectedWriteResult,
  OfflineTargetDocument,
} from './types.js';
import { overlayKey } from './offline_persistence.js';

export class OfflineLocalStore {
  private readonly mutationQueue: OfflineMutationQueue;
  private userIdValue: string;

  constructor(readonly persistence: OfflinePersistence, userId: string = 'anonymous') {
    this.mutationQueue = new OfflineMutationQueue(persistence);
    this.userIdValue = userId;
  }

  get userId(): string {
    return this.userIdValue;
  }

  async start(): Promise<void> {
    await this.persistence.start();
  }

  async shutdown(): Promise<void> {
    await this.persistence.shutdown();
  }

  async writeLocally(
    mutations: OfflineWriteMutation[],
    source: OfflineWriteBatchSource = 'individual'
  ): Promise<OfflineLocalWriteResult> {
    return this.runPersistenceTransaction(async () => {
      const localDocuments = await Promise.all(
        mutations.map(mutation => this.getLocalDocument(mutation.key))
      );
      for (let index = 0; index < mutations.length; index++) {
        const mutation = mutations[index];
        const localDocument = localDocuments[index];
        this.assertMutationPreconditionMatchesLocalView(mutation, localDocument);
      }
      const baseDocuments = await Promise.all(
        mutations.map(mutation => this.getRemoteDocument(mutation.key))
      );
      const batch = new OfflineWriteBatch(
        this.persistence.nextBatchId++,
        Date.now(),
        mutations,
        baseDocuments,
        this.userId,
        source
      );
      await this.mutationQueue.addMutationBatch(batch);
      for (const mutation of mutations) {
        await this.persistence.setDocumentMutation?.({
          userId: this.userId,
          documentPath: mutation.key.path,
          batchId: batch.batchId,
        });
      }
      await this.recomputeOverlays(batch.affectedKeys);
      return {
        batchId: batch.batchId,
        affectedKeys: batch.affectedKeys,
      };
    });
  }

  async getAllMutationBatches(): Promise<OfflineWriteBatch[]> {
    return (await this.mutationQueue.getAllMutationBatches())
      .filter(batch => batch.userId === this.userId);
  }

  async setUserId(userId: string): Promise<OracledbDocumentKey[]> {
    if (userId === this.userIdValue) return [];
    const previousUserId = this.userIdValue;
    try {
      return await this.runPersistenceTransaction(async () => {
        const affectedPaths = new Set<string>();
        const collectUserPaths = async () => {
          for (const batch of await this.getAllMutationBatches()) {
            for (const mutation of batch.mutations) {
              affectedPaths.add(mutation.key.path);
            }
          }
          for (const overlay of this.persistence.documentOverlays.values()) {
            if (overlay.userId === this.userId) {
              affectedPaths.add(overlay.path);
            }
          }
        };
        await collectUserPaths();
        this.userIdValue = userId;
        await collectUserPaths();
        const affectedKeys = [...affectedPaths].map(path => OracledbDocumentKey.fromPath(path));
        await this.recomputeOverlays(affectedKeys);
        return affectedKeys;
      });
    } catch (error) {
      this.userIdValue = previousUserId;
      throw error;
    }
  }

  async hasPendingWrites(key?: { path: string }): Promise<boolean> {
    if (!key) {
      return (await this.getAllMutationBatches()).length > 0;
    }
    return this.pendingBatchIdsForDocument(key.path).length > 0;
  }

  async getHighestUnacknowledgedBatchId(): Promise<number | null> {
    const batches = await this.getAllMutationBatches();
    if (batches.length === 0) return null;
    return Math.max(...batches.map(batch => batch.batchId));
  }

  async hasRemoteDocument(key: OracledbDocumentKey): Promise<boolean> {
    const document = await this.getRemoteDocument(key);
    return Boolean(document && document.documentState !== 'noDocument' && document.data != null);
  }

  async getRemoteDocument(key: OracledbDocumentKey): Promise<OfflineCachedDocument | null> {
    return this.persistence.remoteDocuments.get(key.path) ?? null;
  }

  async saveRemoteDocument(document: OfflineCachedDocument): Promise<void> {
    await this.runPersistenceTransaction(async () => {
      const existing = this.persistence.remoteDocuments.get(document.key.path);
      if (existing && this.compareDocumentSnapshotVersions(document, existing) < 0) {
        await this.recomputeOverlay(document.key);
        return;
      }
      await this.persistence.setRemoteDocument?.({
        ...document,
        documentState: document.documentState ?? (document.data == null ? 'noDocument' : 'found'),
        hasLocalMutations: false,
      });
      await this.recomputeOverlay(document.key);
    });
  }

  async saveRemoteDocuments(documents: OfflineCachedDocument[]): Promise<void> {
    await this.runPersistenceTransaction(async () => {
      for (const document of documents) {
        await this.saveRemoteDocument(document);
      }
    });
  }

  async markRemoteNoDocument(key: OracledbDocumentKey, version = new OracledbDocumentVersion('')): Promise<void> {
    await this.runPersistenceTransaction(async () => {
      await this.persistence.setRemoteDocument?.({
        key,
        data: null,
        version,
        documentState: 'noDocument',
        hasLocalMutations: false,
        hasCommittedMutations: false,
      });
      await this.recomputeOverlay(key);
    });
  }

  async getLocalDocument(key: OracledbDocumentKey): Promise<OfflineCachedDocument | null> {
    const overlay = this.persistence.documentOverlays.get(overlayKey(this.userId, key.path));
    if (overlay) {
      const remote = this.persistence.remoteDocuments.get(key.path);
      return {
        key,
        data: overlay.data,
        version: remote?.version ?? new OracledbDocumentVersion(''),
        updateTime: remote?.updateTime,
        commitTime: remote?.commitTime,
        readTime: remote?.readTime,
        documentState: overlay.documentState,
        hasLocalMutations: overlay.hasLocalMutations,
        hasCommittedMutations: false,
        sequenceNumber: remote?.sequenceNumber,
      };
    }
    return this.persistence.remoteDocuments.get(key.path) ?? null;
  }

  async getLocalDocumentsMatchingPrefix(pathPrefix: string): Promise<OfflineCachedDocument[]> {
    const normalizedPrefix = pathPrefix.split('/').filter(Boolean).join('/');
    const expectedDepth = normalizedPrefix ? normalizedPrefix.split('/').length + 1 : 1;
    const paths = new Set<string>();
    for (const path of this.persistence.remoteDocuments.keys()) {
      paths.add(path);
    }
    for (const overlay of this.persistence.documentOverlays.values()) {
      if (overlay.userId === this.userId) {
        paths.add(overlay.path);
      }
    }
    const docs: OfflineCachedDocument[] = [];
    for (const path of paths) {
      const segments = path.split('/').filter(Boolean);
      const matchesPrefix = !normalizedPrefix || path.startsWith(`${normalizedPrefix}/`);
      if (!matchesPrefix || segments.length !== expectedDepth) continue;
      const document = await this.getLocalDocument(OracledbDocumentKey.fromPath(path));
      if (document) docs.push(document);
    }
    return docs;
  }

  async acknowledgeBatch(batch: OfflineWriteBatch, results: unknown[] = []): Promise<OracledbDocumentKey[]> {
    return this.runPersistenceTransaction(async () => {
      for (let index = 0; index < batch.mutations.length; index++) {
        const mutation = batch.mutations[index];
        await this.applyMutationToRemoteDocument(mutation, results[index]);
        await this.persistence.removeDocumentMutation?.(batch.userId, mutation.key.path, batch.batchId);
      }
      await this.mutationQueue.removeMutationBatch(batch.batchId);
      await this.recomputeOverlays(batch.affectedKeys);
      return batch.affectedKeys;
    });
  }

  async rejectBatch(batch: OfflineWriteBatch): Promise<OfflineRejectedWriteResult> {
    return this.runPersistenceTransaction(async () => {
      const batchesToReject = await this.collectRejectedBatches(batch);
      const affectedPaths = new Set<string>();
      const rejectedBatchIds: number[] = [];
      for (const rejectedBatch of batchesToReject) {
        rejectedBatchIds.push(rejectedBatch.batchId);
        for (const mutation of rejectedBatch.mutations) {
          affectedPaths.add(mutation.key.path);
          await this.persistence.removeDocumentMutation?.(rejectedBatch.userId, mutation.key.path, rejectedBatch.batchId);
        }
        await this.mutationQueue.removeMutationBatch(rejectedBatch.batchId);
      }
      const affectedKeys = [...affectedPaths].map(path => OracledbDocumentKey.fromPath(path));
      await this.recomputeOverlays(affectedKeys);
      return { affectedKeys, rejectedBatchIds };
    });
  }

  async registerTarget(target: Omit<OfflineQueryTarget, 'targetId'>): Promise<OfflineQueryTarget> {
    return this.runPersistenceTransaction(async () => {
      const existing = [...this.persistence.targets.values()].find(candidate =>
        candidate.userId === this.userId &&
        (candidate.canonicalId ?? candidate.canonicalQuery) === (target.canonicalId ?? target.canonicalQuery)
      );
      if (existing) {
        const updated = { ...existing, isActive: true };
        await this.persistence.setTarget?.(updated);
        return updated;
      }
      const globals = {
        ...this.persistence.targetGlobals,
        highestTargetId: this.persistence.targetGlobals.highestTargetId + 1,
        activeTargetCount: (this.persistence.targetGlobals.activeTargetCount ?? 0) + 1,
        currentUserId: this.userId,
      };
      await this.persistence.setTargetGlobals?.(globals);
      const storedTarget: OfflineQueryTarget = {
        ...target,
        userId: this.userId,
        targetId: globals.highestTargetId,
        isActive: true,
      };
      await this.persistence.setTarget?.(storedTarget);
      return storedTarget;
    });
  }

  async deactivateTarget(targetId: number): Promise<void> {
    await this.runPersistenceTransaction(async () => {
      const target = this.persistence.targets.get(targetId);
      if (!target) return;
      await this.persistence.setTarget?.({ ...target, isActive: false });
    });
  }

  getActiveTargets(): OfflineQueryTarget[] {
    return [...this.persistence.targets.values()]
      .filter(target => target.userId === this.userId && target.isActive);
  }

  async updateTargetDocuments(
    target: OfflineQueryTarget,
    serverDocuments: OfflineCachedDocument[],
    markMissingDocumentsAsDeleted: boolean
  ): Promise<OracledbDocumentKey[]> {
    return this.runPersistenceTransaction(async () => {
      const oldPaths = new Set(this.getTargetDocumentPaths(target.targetId));
      const newPaths = new Set(serverDocuments.map(document => document.key.path));
      const affected = new Set<string>();
      for (const document of serverDocuments) {
        affected.add(document.key.path);
        await this.saveRemoteDocument(document);
        await this.persistence.setTargetDocument?.({
          targetId: target.targetId,
          documentPath: document.key.path,
          readTime: document.readTime,
        });
      }
      for (const oldPath of oldPaths) {
        if (newPaths.has(oldPath)) continue;
        const key = OracledbDocumentKey.fromPath(oldPath);
        affected.add(oldPath);
        await this.persistence.removeTargetDocument?.(target.targetId, oldPath);
        if (markMissingDocumentsAsDeleted) {
          await this.markRemoteNoDocument(key);
        } else {
          await this.clearCommittedMutationFlag(key);
        }
      }
      await this.markTargetSnapshotVersion(target);
      return [...affected].map(path => OracledbDocumentKey.fromPath(path));
    });
  }

  async applyRemoteDocumentChangeToTarget(
    target: OfflineQueryTarget,
    document: OfflineCachedDocument,
    belongsToTarget: boolean
  ): Promise<OracledbDocumentKey[]> {
    return this.runPersistenceTransaction(async () => {
      const affected = new Set<string>();
      const wasInTarget = this.getTargetDocumentPaths(target.targetId).includes(document.key.path);
      const isNoDocument = document.data == null || document.documentState === 'noDocument';

      if (isNoDocument) {
        await this.markRemoteNoDocument(document.key, document.version);
        if (wasInTarget) {
          await this.persistence.removeTargetDocument?.(target.targetId, document.key.path);
          affected.add(document.key.path);
        }
      } else if (belongsToTarget) {
        await this.saveRemoteDocument(document);
        await this.persistence.setTargetDocument?.({
          targetId: target.targetId,
          documentPath: document.key.path,
          readTime: document.readTime,
        });
        affected.add(document.key.path);
      } else if (wasInTarget) {
        await this.saveRemoteDocument(document);
        await this.persistence.removeTargetDocument?.(target.targetId, document.key.path);
        affected.add(document.key.path);
      }

      if (affected.size > 0) {
        await this.markTargetSnapshotVersion(target);
      }
      return [...affected].map(path => OracledbDocumentKey.fromPath(path));
    });
  }

  getTargetDocumentPaths(targetId: number): string[] {
    return [...this.persistence.targetDocuments.values()]
      .filter((targetDocument): targetDocument is OfflineTargetDocument =>
        Boolean(targetDocument && targetDocument.targetId === targetId)
      )
      .map(targetDocument => targetDocument.documentPath);
  }

  findTargetForCanonical(canonicalId: string): OfflineQueryTarget | null {
    return [...this.persistence.targets.values()].find(target =>
      target.userId === this.userId &&
      (target.canonicalId ?? target.canonicalQuery) === canonicalId
    ) ?? null;
  }

  private runPersistenceTransaction<T>(operation: () => Promise<T>): Promise<T> {
    return this.persistence.runTransaction
      ? this.persistence.runTransaction(operation)
      : operation();
  }

  private localDocumentExists(document: OfflineCachedDocument | null): boolean {
    return Boolean(document && document.data != null && document.documentState !== 'noDocument');
  }

  private assertMutationPreconditionMatchesLocalView(
    mutation: OfflineWriteMutation,
    document: OfflineCachedDocument | null
  ): void {
    if (mutation.precondition.exists === undefined) return;
    const exists = this.localDocumentExists(document);
    if (mutation.precondition.exists === exists) return;
    if (mutation.precondition.exists) {
      throw new Error(`Document ${mutation.key.path} is not available in cache`);
    }
    throw new Error(`Document ${mutation.key.path} already exists in cache`);
  }

  private async markTargetSnapshotVersion(target: OfflineQueryTarget): Promise<void> {
    const updatedTarget = {
      ...target,
      snapshotVersion: new OracledbSnapshotVersion(String(Date.now())),
    };
    await this.persistence.setTarget?.(updatedTarget);
    await this.persistence.setTargetGlobals?.({
      ...this.persistence.targetGlobals,
      lastRemoteSnapshotVersion: updatedTarget.snapshotVersion,
    });
  }

  private async applyMutationToRemoteDocument(mutation: OfflineWriteMutation, result: unknown): Promise<void> {
    const existing = this.persistence.remoteDocuments.get(mutation.key.path);
    if (mutation.type === 'delete') {
      await this.persistence.setRemoteDocument?.({
        key: mutation.key,
        data: null,
        version: this.versionFromResult(result) ?? existing?.version ?? new OracledbDocumentVersion(''),
        updateTime: this.updateTimeFromResult(result) ?? existing?.updateTime,
        commitTime: this.commitTimeFromResult(result) ?? existing?.commitTime,
        readTime: existing?.readTime,
        documentState: 'noDocument',
        hasLocalMutations: false,
        hasCommittedMutations: true,
        sequenceNumber: existing?.sequenceNumber,
      });
      return;
    }
    const existingState = existing?.documentState ?? (existing?.data == null ? 'noDocument' : 'found');
    if (mutation instanceof OfflinePatchWrite && !this.preconditionMatches(mutation, existing?.data ?? null, existingState)) {
      await this.persistence.setRemoteDocument?.({
        key: mutation.key,
        data: null,
        version: this.versionFromResult(result) ?? existing?.version ?? new OracledbDocumentVersion(''),
        updateTime: this.updateTimeFromResult(result) ?? existing?.updateTime,
        commitTime: this.commitTimeFromResult(result) ?? existing?.commitTime,
        readTime: existing?.readTime,
        documentState: 'noDocument',
        hasLocalMutations: false,
        hasCommittedMutations: true,
        sequenceNumber: existing?.sequenceNumber,
      });
      return;
    }
    const baseData = existing?.data ? { ...existing.data } : {};
    const nextData = mutation instanceof OfflineSetWrite
      ? this.applySet(baseData, mutation.data)
      : mutation instanceof OfflinePatchWrite
        ? this.applyPatch(baseData, mutation)
        : baseData;
    this.applyTransformResults(nextData, mutation, result);
    await this.persistence.setRemoteDocument?.({
      key: mutation.key,
      data: nextData,
      version: this.versionFromResult(result) ?? existing?.version ?? new OracledbDocumentVersion(''),
      updateTime: this.updateTimeFromResult(result) ?? existing?.updateTime,
      commitTime: this.commitTimeFromResult(result) ?? existing?.commitTime,
      readTime: existing?.readTime,
      documentState: 'found',
      hasLocalMutations: false,
      hasCommittedMutations: true,
      sequenceNumber: existing?.sequenceNumber,
    });
  }

  private async recomputeOverlays(keys: OracledbDocumentKey[]): Promise<void> {
    const uniquePaths = new Set(keys.map(key => key.path));
    await Promise.all([...uniquePaths].map(path => this.recomputeOverlay(OracledbDocumentKey.fromPath(path))));
  }

  private async recomputeOverlay(key: OracledbDocumentKey): Promise<void> {
    const pendingBatches = this.pendingBatchesForDocument(key.path);
    if (pendingBatches.length === 0) {
      await this.persistence.removeDocumentOverlay?.(this.userId, key.path);
      return;
    }
    const remote = this.persistence.remoteDocuments.get(key.path);
    let data = remote?.data ? { ...remote.data } : null;
    let documentState: OfflineDocumentOverlay['documentState'] =
      remote?.documentState ?? (data == null ? 'noDocument' : 'found');
    let largestBatchId = 0;
    for (const batch of pendingBatches) {
      for (const mutation of batch.mutations.filter(item => item.key.path === key.path)) {
        largestBatchId = Math.max(largestBatchId, batch.batchId);
        if (!this.preconditionMatches(mutation, data, documentState)) {
          continue;
        }
        if (mutation.type === 'delete') {
          data = null;
          documentState = 'noDocument';
        } else if (mutation instanceof OfflineSetWrite) {
          data = this.applySet(data, mutation.data);
          documentState = 'found';
        } else if (mutation instanceof OfflinePatchWrite) {
          data = this.applyPatch(data ? { ...data } : {}, mutation);
          documentState = 'found';
        }
      }
    }
    await this.persistence.setDocumentOverlay?.({
      userId: this.userId,
      path: key.path,
      key,
      largestBatchId,
      data,
      documentState,
      hasLocalMutations: true,
    });
  }

  private async clearCommittedMutationFlag(key: OracledbDocumentKey): Promise<void> {
    const remote = this.persistence.remoteDocuments.get(key.path);
    if (remote?.hasCommittedMutations) {
      await this.persistence.setRemoteDocument?.({
        ...remote,
        hasCommittedMutations: false,
      });
    }
    await this.recomputeOverlay(key);
  }

  private pendingBatchesForDocument(documentPath: string): OfflineWriteBatch[] {
    const batchIds = this.pendingBatchIdsForDocument(documentPath);
    return batchIds
      .map(batchId => this.persistence.mutationBatches.get(batchId))
      .filter((batch): batch is OfflineWriteBatch => Boolean(batch && batch.userId === this.userId))
      .sort((left, right) => left.batchId - right.batchId);
  }

  private pendingBatchIdsForDocument(documentPath: string): number[] {
    const prefix = `${this.userId}\u0001${documentPath}\u0001`;
    return [...this.persistence.documentMutations.keys()]
      .filter(key => key.startsWith(prefix))
      .map(key => Number(key.slice(prefix.length)))
      .filter(batchId => Number.isFinite(batchId))
      .sort((left, right) => left - right);
  }

  private async collectRejectedBatches(failedBatch: OfflineWriteBatch): Promise<OfflineWriteBatch[]> {
    const pendingBatches = (await this.getAllMutationBatches())
      .filter(batch => batch.batchId >= failedBatch.batchId)
      .sort((left, right) => left.batchId - right.batchId);
    const rejectedBatchIds = new Set<number>([failedBatch.batchId]);
    const rejectedPaths = new Set(failedBatch.mutations.map(mutation => mutation.key.path));

    for (const batch of pendingBatches) {
      if (batch.batchId === failedBatch.batchId) continue;
      if (!batch.mutations.some(mutation => rejectedPaths.has(mutation.key.path))) {
        continue;
      }
      rejectedBatchIds.add(batch.batchId);
      for (const mutation of batch.mutations) {
        rejectedPaths.add(mutation.key.path);
      }
    }

    return pendingBatches.filter(batch => rejectedBatchIds.has(batch.batchId));
  }

  private preconditionMatches(
    mutation: OfflineWriteMutation,
    data: Record<string, unknown> | null,
    documentState: OfflineDocumentOverlay['documentState']
  ): boolean {
    const exists = data != null && documentState === 'found';
    if (mutation.precondition.exists !== undefined) {
      return mutation.precondition.exists === exists;
    }
    return true;
  }

  private applySet(base: Record<string, unknown> | null, data: Record<string, unknown>): Record<string, unknown> {
    const materialized = this.materializeValue(data, base ?? {});
    return materialized.delete ? {} : materialized.value as Record<string, unknown>;
  }

  private applyPatch(base: Record<string, unknown>, mutation: OfflinePatchWrite): Record<string, unknown> {
    const result = { ...base };
    const mask = mutation.fieldMask.length > 0 ? mutation.fieldMask : Object.keys(mutation.data);
    for (const field of mask) {
      const path = String(field);
      const existing = this.getFieldValue(result, path);
      const materialized = this.materializeValue(mutation.data[path] ?? this.getFieldValue(mutation.data, path), existing);
      if (materialized.delete) {
        this.deleteFieldValue(result, path);
      } else {
        this.setFieldValue(result, path, materialized.value);
      }
    }
    return result;
  }

  private materializeValue(value: unknown, existingValue: unknown): { delete: boolean; value?: unknown } {
    if (value instanceof FieldValue) {
      return this.applyFieldValue(value, existingValue);
    }
    if (Array.isArray(value)) {
      return {
        delete: false,
        value: value.map(item => this.materializeValue(item, undefined).value),
      };
    }
    if (value && typeof value === 'object') {
      const baseObject = existingValue && typeof existingValue === 'object' && !Array.isArray(existingValue)
        ? existingValue as Record<string, unknown>
        : {};
      const result: Record<string, unknown> = {};
      for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
        const materialized = this.materializeValue(childValue, baseObject[key]);
        if (!materialized.delete) {
          result[key] = materialized.value;
        }
      }
      return { delete: false, value: result };
    }
    return { delete: false, value };
  }

  private applyFieldValue(value: FieldValue, existingValue: unknown): { delete: boolean; value?: unknown } {
    switch (value.operation) {
      case 'FieldValue:delete':
      case 'FieldValue:deleteVector':
        return { delete: true };
      case 'FieldValue:serverTimestamp':
        return { delete: false, value: new Date().toISOString() };
      case 'FieldValue:increment':
        return {
          delete: false,
          value: typeof existingValue === 'number' ? existingValue + value.value : value.value,
        };
      case 'FieldValue:arrayUnion': {
        const result = Array.isArray(existingValue) ? [...existingValue] : [];
        const values = Array.isArray(value.value) ? value.value : [value.value];
        for (const item of values) {
          if (!result.includes(item)) result.push(item);
        }
        return { delete: false, value: result };
      }
      case 'FieldValue:arrayRemove': {
        const values = Array.isArray(value.value) ? value.value : [value.value];
        return {
          delete: false,
          value: Array.isArray(existingValue)
            ? existingValue.filter(item => !values.includes(item))
            : [],
        };
      }
      default:
        return { delete: false, value: null };
    }
  }

  private getFieldValue(data: Record<string, unknown>, path: string): unknown {
    return this.pathParts(path).reduce<any>((value, key) => value == null ? undefined : value[key], data);
  }

  private setFieldValue(data: Record<string, unknown>, path: string, value: unknown): void {
    const parts = this.pathParts(path);
    let target: Record<string, unknown> = data;
    for (let index = 0; index < parts.length - 1; index++) {
      const key = parts[index];
      const child = target[key];
      if (!child || typeof child !== 'object' || Array.isArray(child)) {
        target[key] = {};
      }
      target = target[key] as Record<string, unknown>;
    }
    target[parts[parts.length - 1]] = value;
  }

  private deleteFieldValue(data: Record<string, unknown>, path: string): void {
    const parts = this.pathParts(path);
    let target: Record<string, unknown> | undefined = data;
    for (let index = 0; index < parts.length - 1; index++) {
      const child = target?.[parts[index]];
      if (!child || typeof child !== 'object' || Array.isArray(child)) return;
      target = child as Record<string, unknown>;
    }
    delete target?.[parts[parts.length - 1]];
  }

  private applyTransformResults(
    data: Record<string, unknown>,
    mutation: OfflineWriteMutation,
    result: unknown
  ): void {
    const transformResults = this.transformResultsFromResult(result);
    if (transformResults.length === 0) return;
    const transformFields = this.transformFieldPaths(mutation);
    for (let index = 0; index < transformFields.length && index < transformResults.length; index++) {
      const transformResult = transformResults[index];
      const fieldPath = this.transformResultFieldPath(transformResult) ?? transformFields[index];
      this.setFieldValue(data, fieldPath, this.transformResultValue(transformResult));
    }
  }

  private transformFieldPaths(mutation: OfflineWriteMutation): string[] {
    if (mutation.fieldTransforms.length > 0) {
      return mutation.fieldTransforms.map(transform => String(transform.field));
    }
    if (mutation instanceof OfflineSetWrite) {
      return this.transformFieldPathsFromData(mutation.data);
    }
    if (mutation instanceof OfflinePatchWrite) {
      const mask = mutation.fieldMask.length > 0 ? mutation.fieldMask : Object.keys(mutation.data);
      const fields: string[] = [];
      for (const field of mask) {
        const path = String(field);
        const value = mutation.data[path] ?? this.getFieldValue(mutation.data, path);
        if (this.isBackendTransform(value)) {
          fields.push(path);
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          fields.push(...this.transformFieldPathsFromData(value as Record<string, unknown>, path));
        }
      }
      return fields;
    }
    return [];
  }

  private transformFieldPathsFromData(data: Record<string, unknown>, prefix = ''): string[] {
    const fields: string[] = [];
    for (const [field, value] of Object.entries(data)) {
      const path = prefix ? `${prefix}.${field}` : field;
      if (this.isBackendTransform(value)) {
        fields.push(path);
      } else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof FieldValue)) {
        fields.push(...this.transformFieldPathsFromData(value as Record<string, unknown>, path));
      }
    }
    return fields;
  }

  private isBackendTransform(value: unknown): value is FieldValue {
    return value instanceof FieldValue &&
      value.operation !== 'FieldValue:delete' &&
      value.operation !== 'FieldValue:deleteVector';
  }

  private pathParts(path: string): string[] {
    const normalized = path.startsWith('$FieldPath$') ? path.slice('$FieldPath$'.length) : path;
    return normalized.includes('#FieldPath#') ? normalized.split('#FieldPath#') : normalized.split('.');
  }

  private compareDocumentSnapshotVersions(left: OfflineCachedDocument, right: OfflineCachedDocument): number {
    const leftMarker = this.documentSnapshotVersionMarker(left);
    const rightMarker = this.documentSnapshotVersionMarker(right);
    if (leftMarker == null || rightMarker == null) return 0;
    if (leftMarker.bigint != null && rightMarker.bigint != null) {
      if (leftMarker.bigint < rightMarker.bigint) return -1;
      if (leftMarker.bigint > rightMarker.bigint) return 1;
      return 0;
    }
    if (leftMarker.epochMs != null && rightMarker.epochMs != null) {
      if (leftMarker.epochMs < rightMarker.epochMs) return -1;
      if (leftMarker.epochMs > rightMarker.epochMs) return 1;
      return 0;
    }
    if (leftMarker.text === rightMarker.text) return 0;
    return 0;
  }

  private documentSnapshotVersionMarker(document: OfflineCachedDocument): { text: string; bigint?: bigint; epochMs?: number } | null {
    const raw = document.version?.value ?? document.updateTime ?? document.readTime;
    if (raw == null || raw === '') return null;
    const text = String(raw);
    try {
      return { text, bigint: BigInt(text) };
    } catch {
      const epochMs = Date.parse(text);
      return Number.isNaN(epochMs) ? { text } : { text, epochMs };
    }
  }

  private versionFromResult(result: any): OracledbDocumentVersion | null {
    const value = result?.VERSION ?? result?.version;
    return value == null ? null : new OracledbDocumentVersion(String(value));
  }

  private updateTimeFromResult(result: any): string | undefined {
    return result?.LAST_MODIFIED ?? result?.updateTime;
  }

  private commitTimeFromResult(result: any): string | undefined {
    return result?.commitTime ?? result?.COMMIT_TIME;
  }

  private transformResultsFromResult(result: any): unknown[] {
    return Array.isArray(result?.transformResults) ? result.transformResults : [];
  }

  private transformResultFieldPath(result: unknown): string | null {
    if (!result || typeof result !== 'object') return null;
    const record = result as Record<string, unknown>;
    const field = record.fieldPath ?? record.field ?? record.path;
    return typeof field === 'string' ? field : null;
  }

  private transformResultValue(result: unknown): unknown {
    if (!result || typeof result !== 'object') return result;
    const record = result as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(record, 'value')) return record.value;
    if (Object.prototype.hasOwnProperty.call(record, 'result')) return record.result;
    return result;
  }
}
