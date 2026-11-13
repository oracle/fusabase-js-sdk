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

import { CollectionReference, DualityViewColReference, Query } from '../collection/reference.js';
import { QuerySnapshot } from '../collection/snapshot.js';
import { DocumentReference, DualityViewDocReference } from '../document/reference.js';
import { DocumentSnapshot } from '../document/snapshot.js';
import { Oracledb } from '../internal/core.js';
import { OfflineQueryTarget } from '../local/types.js';
import { OracledbDocumentKey } from '../model/index.js';
import { getToken, snapHashcode } from '../util/utils.js';
import { IdTokenResult } from '../../../auth/src/types/idtoken.js';
import { DocumentData } from '../types/common.js';

type WatchTarget =
  | Query<any, any>
  | CollectionReference<any, any>
  | DualityViewColReference<any, any>
  | DocumentReference<any, any>
  | DualityViewDocReference<any, any>;

export type OfflineRemoteWatchDocumentChange = {
  targetId: number;
  key: OracledbDocumentKey;
  data: DocumentData | null;
  version?: string;
  updateTime?: string;
  commitTime?: string;
  readTime?: string;
};

/** @internal Identifies a terminal realtime registration failure. */
export class OfflineRealtimeUnavailableError extends Error {
  readonly code = 'UNAVAILABLE';

  constructor(message: string) {
    super(message);
    this.name = 'OfflineRealtimeUnavailableError';
  }
}

type OfflineRemoteWatchObserver = {
  nextSnapshot: (snapshot: QuerySnapshot<any, any> | DocumentSnapshot<any, any>) => void;
  nextDocumentChange: (change: OfflineRemoteWatchDocumentChange) => void;
  error: (error: unknown) => void;
};

type ListenPayload = {
  queryId: number;
  payload: {
    path: string[];
    conditions: any[];
  };
  queryObject: Record<string, unknown>;
};

export class OfflineRemoteWatch {
  constructor(private readonly db: Oracledb) {}

  listen(
    target: WatchTarget,
    storedTarget: OfflineQueryTarget,
    observer: OfflineRemoteWatchObserver
  ): () => void {
    return this.usesLongPolling()
      ? this.listenWithPolling(target, observer)
      : this.listenWithSocket(target, storedTarget, observer);
  }

  private listenWithSocket(
    target: WatchTarget,
    storedTarget: OfflineQueryTarget,
    observer: OfflineRemoteWatchObserver
  ): () => void {
    const listenPayload = this.buildListenPayload(target, storedTarget);
    let closed = false;
    let authStateKey = (this.db as any).__getAuthStateKey();
    let realtimeGeneration = (this.db as any).__getRealtimeGeneration();
    const stop = (error?: Error, sendUnsubscribe = false) => {
      if (closed) return;
      closed = true;
      this.db.eventManager?.removeEventListener?.('offline socket message', handleMessage);
      this.db.eventManager?.removeEventListener?.('authentication changed', handleAuthChange);
      if (sendUnsubscribe) {
        (this.db as any).__sendMessage({
          queryId: listenPayload.queryId,
          status: 0,
          payload: listenPayload.payload,
        });
      }
      if (error) observer.error(error);
    };
    const handleAuthChange = () => {
      stop(new Error('Offline listener ended because authentication changed.'));
    };
    const handleMessage = (event: Event) => {
      if (closed ||
          authStateKey !== (this.db as any).__getAuthStateKey() ||
          realtimeGeneration !== (this.db as any).__getRealtimeGeneration()) {
        if (!closed) handleAuthChange();
        return;
      }
      const message = (event as CustomEvent<any>).detail;
      if (!message || message.queryId !== listenPayload.queryId) {
        return;
      }
      if (message.code === 'UNAVAILABLE' && typeof message.error === 'string') {
        stop(new OfflineRealtimeUnavailableError(message.error));
        return;
      }
      if (!message.rowId) return;
      const change = this.documentChangeFromSocketMessage(storedTarget, message);
      if (change) {
        observer.nextDocumentChange(change);
      }
    };

    this.db.eventManager?.addEventListener?.('offline socket message', handleMessage);
    this.db.eventManager?.addEventListener?.('authentication changed', handleAuthChange);
    (this.db as any).__ensureAuthStateListener();
    this.openSocket()
      .then(() => {
        if (closed || authStateKey !== (this.db as any).__getAuthStateKey()) {
          if (!closed) handleAuthChange();
          return;
        }
        realtimeGeneration = (this.db as any).__getRealtimeGeneration();
        (this.db as any).__sendMessage(listenPayload.queryObject);
        return this.fetchInitialSnapshot(target);
      })
      .then(snapshot => {
        if (!closed && snapshot &&
            authStateKey === (this.db as any).__getAuthStateKey() &&
            realtimeGeneration === (this.db as any).__getRealtimeGeneration()) {
          observer.nextSnapshot(snapshot);
        } else if (!closed) {
          handleAuthChange();
        }
      })
      .catch(error => {
        if (!closed) stop(error instanceof Error ? error : new Error(String(error)));
      });

    return () => {
      stop(undefined, true);
    };
  }

  private listenWithPolling(
    target: WatchTarget,
    observer: OfflineRemoteWatchObserver
  ): () => void {
    let closed = false;
    const authStateKey = (this.db as any).__getAuthStateKey();
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const stop = (error?: Error) => {
      if (closed) return;
      closed = true;
      if (intervalId) clearInterval(intervalId);
      this.db.eventManager?.removeEventListener?.('authentication changed', handleAuthChange);
      if (error) observer.error(error);
    };
    const handleAuthChange = () => {
      stop(new Error('Offline listener ended because authentication changed.'));
    };
    const fetchSnapshot = () => {
      if (closed || authStateKey !== (this.db as any).__getAuthStateKey()) {
        if (!closed) handleAuthChange();
        return;
      }
      this.fetchInitialSnapshot(target)
        .then(snapshot => {
          if (!closed && authStateKey === (this.db as any).__getAuthStateKey()) {
            observer.nextSnapshot(snapshot);
          } else if (!closed) {
            handleAuthChange();
          }
        })
        .catch(error => {
          if (!closed) {
            this.db.eventManager?.dispatchEvent?.(new Event('long polling error'));
            stop(error instanceof Error ? error : new Error(String(error)));
          }
        });
    };
    (this.db as any).__ensureAuthStateListener();
    this.db.eventManager?.addEventListener?.('authentication changed', handleAuthChange);
    fetchSnapshot();
    intervalId = setInterval(
      fetchSnapshot,
      (this.db._settings.experimentalLongPollingOptions?.timeoutSeconds || 10) * 1000
    );

    return () => {
      stop();
    };
  }

  private async openSocket(): Promise<void> {
    const token = getToken(this.db.app);
    const idToken = token ? new IdTokenResult(token) : null;
    await (this.db as any).__createSocket(idToken ? idToken.token : null);
  }

  private fetchInitialSnapshot(target: WatchTarget): Promise<QuerySnapshot<any, any> | DocumentSnapshot<any, any>> {
    return (target as any).get();
  }

  private usesLongPolling(): boolean {
    return Boolean(
      this.db._settings.experimentalAutoDetectLongPolling ||
      this.db._settings.experimentalForceLongPolling
    );
  }

  private buildListenPayload(target: WatchTarget, storedTarget: OfflineQueryTarget): ListenPayload {
    const isDocumentTarget = target instanceof DocumentReference || target instanceof DualityViewDocReference || storedTarget.targetType === 'document';
    const targetLike = target as any;
    const payload = isDocumentTarget
      ? {
        path: this.pathSegments(storedTarget.path, targetLike._path),
        conditions: [],
      }
      : {
        path: this.pathSegments(storedTarget.path, targetLike._path),
        conditions: targetLike._conditions ?? storedTarget.filters ?? [],
      };
    const subscriptionIdentity = {
      targetType: storedTarget.referenceType,
      path: payload.path,
      conditions: payload.conditions,
      explicitOrder: targetLike._explicitOrder ?? [],
      limit: targetLike._limit ?? 0,
      column: targetLike._column ?? []
    };
    const queryId = Math.abs(snapHashcode(JSON.stringify(subscriptionIdentity)));
    const queryObject: Record<string, unknown> = {
      queryId,
      status: 1,
      payload,
    };
    return { queryId, payload, queryObject };
  }

  private pathSegments(path?: string, fallback?: string[]): string[] {
    if (Array.isArray(fallback) && fallback.length > 0) {
      return fallback;
    }
    return path ? path.split('/').filter(Boolean) : [];
  }

  private documentChangeFromSocketMessage(
    target: OfflineQueryTarget,
    message: any
  ): OfflineRemoteWatchDocumentChange | null {
    const operation = String(message.operations?.[message.operations.length - 1] ?? '').toUpperCase();
    const changedData = message.changedData && typeof message.changedData === 'object'
      ? { ...message.changedData }
      : {};
    const messageMetadata = message._metadata && typeof message._metadata === 'object'
      ? message._metadata
      : {};
    let oid = messageMetadata.OID != null
      ? String(messageMetadata.OID)
      : changedData.OID != null
        ? String(changedData.OID)
        : undefined;
    delete changedData.OID;

    const metadata = changedData._metadata;
    let version = messageMetadata.VERSION != null
      ? String(messageMetadata.VERSION)
      : typeof metadata?.etag === 'string'
        ? metadata.etag
        : undefined;
    let readTime = messageMetadata.ASOF != null
      ? String(messageMetadata.ASOF)
      : typeof metadata?.asof === 'string'
        ? metadata.asof
        : undefined;
    delete changedData._metadata;

    if (changedData.VERSION != null) {
      version = String(changedData.VERSION);
      delete changedData.VERSION;
    }
    if (changedData.ASOF != null) {
      readTime = String(changedData.ASOF);
      delete changedData.ASOF;
    }

    const updateTime = messageMetadata.LAST_MODIFIED != null
      ? String(messageMetadata.LAST_MODIFIED)
      : changedData.LAST_MODIFIED != null
        ? String(changedData.LAST_MODIFIED)
        : undefined;
    delete changedData.LAST_MODIFIED;
    const commitTime = messageMetadata.COMMIT_TIME != null
      ? String(messageMetadata.COMMIT_TIME)
      : changedData.commitTime != null
        ? String(changedData.commitTime)
        : changedData.COMMIT_TIME != null
          ? String(changedData.COMMIT_TIME)
          : undefined;
    delete changedData.commitTime;
    delete changedData.COMMIT_TIME;

    if (target.targetType === 'document') {
      const targetId = target.path?.split('/').filter(Boolean).pop();
      if (oid && targetId && oid !== targetId) return null;
      oid = targetId ?? oid;
    }
    if (!oid) return null;

    const path = target.targetType === 'document'
      ? target.path ?? oid
      : `${target.path ?? ''}/${oid}`.replace(/^\/+/, '');
    const data = operation === 'DELETE' ? null : changedData as DocumentData;

    return {
      targetId: target.targetId,
      key: OracledbDocumentKey.fromPath(path),
      data,
      version,
      updateTime,
      commitTime,
      readTime,
    };
  }
}
