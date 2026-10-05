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

import { CollectionReference, Query } from '../collection/reference.js';
import { QuerySnapshot } from '../collection/snapshot.js';
import { DocumentReference } from '../document/reference.js';
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
  | DocumentReference<any, any>;

export type OfflineRemoteWatchDocumentChange = {
  targetId: number;
  key: OracledbDocumentKey;
  data: DocumentData | null;
  version?: string;
  updateTime?: string;
  commitTime?: string;
  readTime?: string;
};

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
    explicitOrder: any[];
    joins?: any[];
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
    const handleMessage = (event: Event) => {
      if (closed) return;
      const message = (event as CustomEvent<any>).detail;
      if (!message || message.queryId !== listenPayload.queryId || !message.rowId) {
        return;
      }
      const change = this.documentChangeFromSocketMessage(storedTarget, message);
      if (change) {
        observer.nextDocumentChange(change);
      }
    };

    this.db.eventManager?.addEventListener?.('offline socket message', handleMessage);
    this.openSocket()
      .then(() => {
        if (closed) return;
        (this.db as any).__sendMessage(listenPayload.queryObject);
        return this.fetchInitialSnapshot(target);
      })
      .then(snapshot => {
        if (!closed && snapshot) {
          observer.nextSnapshot(snapshot);
        }
      })
      .catch(error => {
        if (!closed) observer.error(error);
      });

    return () => {
      closed = true;
      this.db.eventManager?.removeEventListener?.('offline socket message', handleMessage);
      (this.db as any).__sendMessage({
        queryId: listenPayload.queryId,
        status: 0,
        payload: listenPayload.payload,
      });
    };
  }

  private listenWithPolling(
    target: WatchTarget,
    observer: OfflineRemoteWatchObserver
  ): () => void {
    let closed = false;
    const fetchSnapshot = () => {
      this.fetchInitialSnapshot(target)
        .then(snapshot => {
          if (!closed) {
            observer.nextSnapshot(snapshot);
          }
        })
        .catch(error => {
          if (!closed) {
            this.db.eventManager?.dispatchEvent?.(new Event('long polling error'));
            observer.error(error);
          }
        });
    };
    fetchSnapshot();
    const intervalId = setInterval(
      fetchSnapshot,
      (this.db._settings.experimentalLongPollingOptions?.timeoutSeconds || 10) * 1000
    );

    return () => {
      closed = true;
      clearInterval(intervalId);
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
    const isDocumentTarget = target instanceof DocumentReference || storedTarget.targetType === 'document';
    const targetLike = target as any;
    const payload = isDocumentTarget
      ? {
        path: this.pathSegments(storedTarget.path, targetLike._path),
        conditions: [],
        explicitOrder: [],
      }
      : {
        path: this.pathSegments(storedTarget.path, targetLike._path),
        conditions: targetLike._conditions ?? storedTarget.filters ?? [],
        explicitOrder: targetLike._explicitOrder ?? storedTarget.orderBy ?? [],
        joins: targetLike._joins ?? [],
      };
    const queryId = Math.abs(snapHashcode(JSON.stringify(payload)));
    const queryObject: Record<string, unknown> = {
      queryId,
      status: 1,
      payload,
    };
    if (!isDocumentTarget) {
      queryObject.TABLE_NAME = '';
    }
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
    let oid = changedData.OID != null ? String(changedData.OID) : undefined;
    delete changedData.OID;

    const metadata = changedData._metadata;
    let version = typeof metadata?.etag === 'string' ? metadata.etag : undefined;
    let readTime = typeof metadata?.asof === 'string' ? metadata.asof : undefined;
    delete changedData._metadata;

    if (changedData.VERSION != null) {
      version = String(changedData.VERSION);
      delete changedData.VERSION;
    }
    if (changedData.ASOF != null) {
      readTime = String(changedData.ASOF);
      delete changedData.ASOF;
    }

    const updateTime = changedData.LAST_MODIFIED != null ? String(changedData.LAST_MODIFIED) : undefined;
    delete changedData.LAST_MODIFIED;
    const commitTime = changedData.commitTime != null
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
