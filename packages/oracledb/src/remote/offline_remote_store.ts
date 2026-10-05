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

import { DocumentReference } from '../document/reference.js';
import { Oracledb } from '../internal/core.js';
import { OfflineLocalStore } from '../local/index.js';
import { OfflinePatchWrite, OfflineSetWrite, OfflineWriteBatch, OfflineWriteMutation } from '../model/index.js';
import { OfflineOracledbSerializer } from './offline_serializer.js';
import { OfflineWritePipeline } from './offline_write_pipeline.js';

type BatchCallback = (
  batch: OfflineWriteBatch,
  error?: unknown,
  affectedKeys?: Array<{ path: string }>,
  rejectedBatchIds?: number[]
) => void;
type RemoteStateCallback = (error?: unknown) => void;

export class OfflineRemoteStore {
  private readonly pipeline = new OfflineWritePipeline();
  private readonly serializer = new OfflineOracledbSerializer();
  private networkEnabled = true;
  private sending = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempts = 0;
  private readonly initialBackoffMs = 1000;
  private readonly maxBackoffMs = 60000;

  constructor(
    private readonly db: Oracledb,
    private readonly localStore: OfflineLocalStore,
    private readonly onBatchAcknowledged: BatchCallback = () => undefined,
    private readonly onBatchRejected: BatchCallback = () => undefined,
    private readonly onRemoteAttemptStarted: RemoteStateCallback = () => undefined,
    private readonly onRemoteSuccess: RemoteStateCallback = () => undefined,
    private readonly onRemoteFailure: RemoteStateCallback = () => undefined
  ) {}

  async fillWritePipeline(): Promise<void> {
    for (const batch of await this.localStore.getAllMutationBatches()) {
      this.pipeline.enqueue(batch);
    }
  }

  async sendMutationBatch(batch: OfflineWriteBatch): Promise<void> {
    const results: unknown[] = [];
    const transactionName = `offline-${batch.batchId}`;
    for (let index = 0; index < batch.mutations.length; index++) {
      const transaction = {
        name: transactionName,
        start: index === 0 ? 1 : 0,
        end: index === batch.mutations.length - 1 ? 1 : 0,
      };
      results.push(await this.sendMutation(batch.mutations[index], transaction));
    }
    const affectedKeys = await this.localStore.acknowledgeBatch(batch, results);
    this.retryAttempts = 0;
    this.onBatchAcknowledged(batch, undefined, affectedKeys);
  }

  async resumeNetwork(inhibitBackoff = false): Promise<void> {
    const wasEnabled = this.networkEnabled;
    this.networkEnabled = true;
    if (!wasEnabled || inhibitBackoff) {
      this.clearRetry();
    }
    await this.fillWritePipeline();
    if (this.retryTimer) return;
    await this.drainPipeline();
  }

  async pauseNetwork(): Promise<void> {
    this.networkEnabled = false;
    this.clearRetry();
  }

  private async drainPipeline(): Promise<void> {
    if (this.sending) return;
    this.sending = true;
    try {
      while (this.networkEnabled && this.pipeline.length > 0) {
        const batch = this.pipeline.peek();
        if (!batch) break;
        const stillPending = (await this.localStore.getAllMutationBatches())
          .some(pendingBatch => pendingBatch.batchId === batch.batchId);
        if (!stillPending) {
          this.pipeline.shift();
          continue;
        }
        try {
          this.onRemoteAttemptStarted();
          await this.sendMutationBatch(batch);
          this.pipeline.shift();
          this.onRemoteSuccess();
        } catch (error) {
          if (this.isPermanentError(error)) {
            this.onRemoteSuccess(error);
            const rejectResult = await this.localStore.rejectBatch(batch);
            this.onBatchRejected(batch, error, rejectResult.affectedKeys, rejectResult.rejectedBatchIds);
            this.pipeline.shift();
            continue;
          }
          this.onRemoteFailure(error);
          this.scheduleRetry();
          break;
        }
      }
    } finally {
      this.sending = false;
    }
  }

  private async sendMutation(mutation: OfflineWriteMutation, transaction: { name: string; start: number; end: number }): Promise<unknown> {
    const ref = new DocumentReference(this.db, mutation.key.path);
    if (mutation.precondition.exists === false) {
      const current = await ref.get();
      if (current.exists()) {
        const error = new Error('Document already exists') as Error & { status?: number; code?: string };
        error.status = 409;
        error.code = 'already-exists';
        throw error;
      }
    }

    const request = this.serializer.toWriteRequest(mutation);
    switch (request.operation) {
      case 'set':
        return ref.set(
          (mutation as OfflineSetWrite | OfflinePatchWrite).data as any,
          { merge: request.merge, mergeFields: request.mergeFields },
          transaction
        );
      case 'update':
        return ref.update((mutation as OfflinePatchWrite).data as any, transaction);
      case 'delete':
        return ref.delete(transaction);
      default:
        throw new Error(`Unsupported offline write operation ${(request as any).operation}`);
    }
  }

  private isPermanentError(error: any): boolean {
    const code = this.normalizedErrorCode(error);
    if (code != null && [
      'permission-denied',
      'not-found',
      'already-exists',
      'failed-precondition',
      'invalid-argument',
      'unauthenticated',
    ].includes(code)) {
      return true;
    }
    const status = error?.status;
    if (status == null) return false;
    return [400, 401, 403, 404, 409, 412].includes(status);
  }

  private normalizedErrorCode(error: any): string | undefined {
    const code = error?.code;
    if (typeof code !== 'string') return undefined;
    return code.includes('/') ? code.slice(code.lastIndexOf('/') + 1) : code;
  }

  private scheduleRetry(): void {
    if (!this.networkEnabled || this.retryTimer) return;
    const delayMs = Math.min(
      this.initialBackoffMs * 2 ** this.retryAttempts,
      this.maxBackoffMs
    );
    this.retryAttempts += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.networkEnabled) return;
      this.fillWritePipeline()
        .then(() => this.drainPipeline())
        .catch(() => this.scheduleRetry());
    }, delayMs);
  }

  private clearRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.retryAttempts = 0;
  }
}
