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

import { QuerySnapshot } from '../collection/snapshot.js';
import { CollectionReference, Query } from '../collection/reference.js';
import { DocumentReference } from '../document/reference.js';
import { DocumentSnapshot } from '../document/snapshot.js';
import { OracledbDocumentKey } from '../model/index.js';
import { ListenObserver, ListenOptions, Unsubscribe } from './offline_sync_coordinator.js';

type ListenTarget<AppModelType = any> =
  | Query<AppModelType, any>
  | CollectionReference<AppModelType, any>
  | DocumentReference<AppModelType, any>;

type SnapshotForTarget =
  | QuerySnapshot<any, any>
  | DocumentSnapshot<any, any>;

type ListenerRegistration = {
  target: ListenTarget;
  options: ListenOptions;
  observer: ListenObserver<any>;
  lastSnapshot?: SnapshotForTarget;
  raisedInitialEvent?: boolean;
};

export class OfflineEventHub {
  private readonly listeners = new Set<ListenerRegistration>();

  constructor(
    private readonly readSnapshot: (target: ListenTarget, options: ListenOptions) => Promise<SnapshotForTarget>,
    private readonly canUseNetwork: () => boolean
  ) {}

  listen<AppModelType>(
    target: ListenTarget<AppModelType>,
    options: ListenOptions,
    observer: ListenObserver<QuerySnapshot<AppModelType, any> | DocumentSnapshot<AppModelType, any>>
  ): Unsubscribe {
    const registration: ListenerRegistration = { target, options, observer };
    this.listeners.add(registration);
    this.emitListener(registration).catch(error => observer.error?.(error));
    return () => {
      this.listeners.delete(registration);
    };
  }

  async emitSnapshots(affectedKeys: OracledbDocumentKey[] = []): Promise<void> {
    await Promise.all([...this.listeners].map(async listener => {
      if (affectedKeys.length > 0 && !this.isAffected(listener.target, affectedKeys)) {
        return;
      }
      await this.emitListener(listener);
    }));
  }

  hasDocumentInActiveSnapshot(path: string): boolean {
    for (const listener of this.listeners) {
      const snapshot = listener.lastSnapshot;
      if (snapshot instanceof DocumentSnapshot) {
        if (snapshot.exists() && this.documentKey(snapshot) === path) {
          return true;
        }
        continue;
      }
      if (snapshot instanceof QuerySnapshot && snapshot.docs.some(doc => this.documentKey(doc) === path)) {
        return true;
      }
    }
    return false;
  }

  private async emitListener(listener: ListenerRegistration): Promise<void> {
    const previous = listener.lastSnapshot;
    const snapshot = await this.readSnapshot(listener.target, listener.options);
    if (snapshot instanceof QuerySnapshot) {
      snapshot._docChanges = this.queryDocChanges(
        previous instanceof QuerySnapshot ? previous : undefined,
        snapshot
      ) as any;
    }
    if (!listener.raisedInitialEvent) {
      if (!this.shouldRaiseInitialEvent(listener, snapshot)) {
        listener.lastSnapshot = snapshot;
        return;
      }
      listener.raisedInitialEvent = true;
      if (snapshot instanceof QuerySnapshot && !(previous instanceof QuerySnapshot)) {
        snapshot._docChanges = this.queryDocChanges(undefined, snapshot) as any;
      }
      listener.lastSnapshot = snapshot;
      listener.observer.next(snapshot);
      return;
    }
    if (!this.shouldEmit(listener, snapshot)) {
      listener.lastSnapshot = snapshot;
      return;
    }
    listener.lastSnapshot = snapshot;
    listener.observer.next(snapshot);
  }

  private shouldEmit(listener: ListenerRegistration, snapshot: SnapshotForTarget): boolean {
    if (!listener.lastSnapshot) return true;
    const previous = listener.lastSnapshot;
    const metadataChanged =
      !previous.metadata.isEqual(snapshot.metadata) ||
      this.snapshotDocumentMetadataKey(previous) !== this.snapshotDocumentMetadataKey(snapshot);
    const dataChanged = this.snapshotDataKey(previous) !== this.snapshotDataKey(snapshot);
    return dataChanged || (metadataChanged && listener.options.includeMetadataChanges === true);
  }

  private shouldRaiseInitialEvent(listener: ListenerRegistration, snapshot: SnapshotForTarget): boolean {
    if (!snapshot.metadata.fromCache) return true;
    if (listener.options.source === 'cache') return true;
    if (!this.canUseNetwork()) return true;
    if (snapshot.metadata.hasPendingWrites) return true;
    if (listener.options.waitForSyncWhenOnline === true) return false;
    if (snapshot instanceof QuerySnapshot) return !snapshot.empty;
    return snapshot.exists();
  }

  private snapshotDataKey(snapshot: SnapshotForTarget): string {
    if (snapshot instanceof QuerySnapshot) {
      return JSON.stringify(snapshot.docs.map(doc => [
        this.documentKey(doc),
        this.normalizedDocumentData(doc),
      ]));
    }
    return JSON.stringify(snapshot.exists() ? {
      data: this.normalizedDocumentData(snapshot),
    } : null);
  }

  private snapshotDocumentMetadataKey(snapshot: SnapshotForTarget): string {
    if (snapshot instanceof QuerySnapshot) {
      return JSON.stringify(snapshot.docs.map(doc => [
        this.documentKey(doc),
        doc.metadata.fromCache,
        doc.metadata.hasPendingWrites,
      ]));
    }
    return JSON.stringify([
      snapshot.metadata.fromCache,
      snapshot.metadata.hasPendingWrites,
    ]);
  }

  private isAffected(target: ListenTarget, affectedKeys: OracledbDocumentKey[]): boolean {
    if (target instanceof DocumentReference) {
      return affectedKeys.some(key => key.path === target.path);
    }
    const targetPath = Array.isArray((target as any)._path) ? (target as any)._path.join('/') : '';
    return affectedKeys.some(key => key.path.startsWith(`${targetPath}/`));
  }

  private queryDocChanges(
    previous: QuerySnapshot<any, any> | undefined,
    current: QuerySnapshot<any, any>
  ): Array<{ doc: any; type: 'added' | 'modified' | 'removed'; oldIndex: number; newIndex: number }> {
    if (!previous) {
      return current.docs.map((doc, index) => ({
        doc,
        type: 'added' as const,
        oldIndex: -1,
        newIndex: index,
      }));
    }
    const previousByKey = new Map(previous.docs.map((doc, index) => [this.documentKey(doc), { doc, index }]));
    const currentByKey = new Map(current.docs.map((doc, index) => [this.documentKey(doc), { doc, index }]));
    const changes: Array<{ doc: any; type: 'added' | 'modified' | 'removed'; oldIndex: number; newIndex: number }> = [];

    for (const [key, previousEntry] of previousByKey) {
      if (!currentByKey.has(key)) {
        changes.push({
          doc: previousEntry.doc,
          type: 'removed',
          oldIndex: previousEntry.index,
          newIndex: -1,
        });
      }
    }

    for (const [key, currentEntry] of currentByKey) {
      const previousEntry = previousByKey.get(key);
      if (!previousEntry) {
        changes.push({
          doc: currentEntry.doc,
          type: 'added',
          oldIndex: -1,
          newIndex: currentEntry.index,
        });
        continue;
      }
      if (this.documentDataKey(previousEntry.doc) !== this.documentDataKey(currentEntry.doc)) {
        changes.push({
          doc: currentEntry.doc,
          type: 'modified',
          oldIndex: previousEntry.index,
          newIndex: currentEntry.index,
        });
      }
    }

    return changes;
  }

  private documentDataKey(doc: DocumentSnapshot<any, any>): string {
    return JSON.stringify({
      data: this.normalizedDocumentData(doc),
    });
  }

  private documentKey(doc: DocumentSnapshot<any, any>): string {
    return doc.ref?.path ?? doc.id;
  }

  private normalizedDocumentData(doc: DocumentSnapshot<any, any>): unknown {
    if (!doc.exists()) return null;
    return this.normalizeDataValue(doc.data());
  }

  private normalizeDataValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(item => this.normalizeDataValue(item));
    }
    if (!value || typeof value !== 'object') {
      return value;
    }
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      if (key === 'OID' || key === 'VERSION' || key === 'LAST_MODIFIED') {
        continue;
      }
      normalized[key] = this.normalizeDataValue((value as Record<string, unknown>)[key]);
    }
    return normalized;
  }
}
