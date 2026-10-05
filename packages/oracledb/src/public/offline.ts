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
import { isQuerySnapshotFromFailedRequest, QuerySnapshot } from '../collection/snapshot.js';
import { DocumentReference } from '../document/reference.js';
import { DocumentSnapshot } from '../document/snapshot.js';
import { Oracledb } from '../internal/core.js';
import { OfflineEventHub, OfflineSyncCoordinator } from '../core/index.js';
import type { ListenOptions, ListenObserver, Unsubscribe } from '../core/index.js';
import {
  OfflineIndexedDbPersistence,
  OfflineLocalStore,
  OfflineMemoryPersistence,
  OfflineQueryEngine,
} from '../local/index.js';
import type { OfflineCachedDocument, OfflineOptions, OfflinePersistence, OfflineQueryTarget } from '../local/index.js';
import { OfflineWriteBatchSource, OfflineWriteMutation, OracledbDocumentKey, OracledbDocumentVersion } from '../model/index.js';
import { OfflineConnectivityTracker, OfflineOnlineStateTracker, OfflineRemoteStore, OfflineRemoteWatch, OfflineSharedClientState, OfflineTabCoordinator } from '../remote/index.js';
import type {
  OfflineOnlineState,
  OfflineRemoteWatchDocumentChange,
  OfflineSharedCacheEvent,
  OfflineSharedMutationEvent,
  OfflineSharedQueryEvent,
  OfflineSharedTargetDescriptor,
} from '../remote/index.js';
import { getToken } from '../util/utils.js';
import { canonicalIdForTarget } from '../local/offline_query_engine.js';
import { matchesQueryFilters } from '../local/offline_query_matcher.js';

export type PersistentLocalCacheOptions = {
  cacheSizeBytes?: number;
  synchronizeTabs?: boolean;
};

type OfflineState = {
  persistence: OfflinePersistence;
  localStore: OfflineLocalStore;
  remoteStore: OfflineRemoteStore;
  remoteWatch: OfflineRemoteWatch;
  syncCoordinator: OfflineSyncCoordinator;
  eventHub: OfflineEventHub;
  queryEngine: OfflineQueryEngine;
  connectivityTracker: OfflineConnectivityTracker;
  onlineStateTracker: OfflineOnlineStateTracker;
  tabCoordinator: OfflineTabCoordinator;
  sharedClientState: OfflineSharedClientState;
  networkEnabled: boolean;
  activeTargetRefs: Map<number, ActiveTargetRef>;
  pendingWriteResolvers: Map<number, PendingWriteResolver[]>;
  sharedStateQueue: Promise<void>;
  ignoreTransportFailuresUntil?: number;
  unsubscribeConnectivityListener?: () => void;
  unsubscribeRemoteFailureListener?: () => void;
};

type PendingWriteResolver = {
  userId: string;
  kind: 'write' | 'wait';
  resolve: () => void;
  reject: (error: unknown) => void;
};

type SnapshotTarget =
  | Query<any, any>
  | CollectionReference<any, any>
  | DocumentReference<any, any>;

type ActiveTargetRef = {
  target: SnapshotTarget;
  remoteUnsubscribe?: Unsubscribe;
  retryTimer?: ReturnType<typeof setTimeout> | null;
  retryAttempts?: number;
  current?: boolean;
  shared?: boolean;
};

const OFFLINE_STATE = new WeakMap<Oracledb, OfflineState>();

function getDbFromRefOrQuery(source: any): Oracledb {
  const db = source?.oracledb;
  if (!(db instanceof Oracledb)) {
    throw new Error('Invalid OracleDB reference or query');
  }
  return db;
}

function createState(db: Oracledb, persistence: OfflinePersistence, options?: OfflineOptions): OfflineState {
  const localStore = new OfflineLocalStore(persistence, currentUserId(db));
  const databaseName = `${db.app.options.appID ?? db.app.name}-oracledb-offline`;
  const state: OfflineState = {
    persistence,
    localStore,
    remoteStore: null as any,
    remoteWatch: null as any,
    syncCoordinator: null as any,
    eventHub: null as any,
    queryEngine: new OfflineQueryEngine(localStore),
    connectivityTracker: new OfflineConnectivityTracker(),
    onlineStateTracker: null as any,
    tabCoordinator: null as any,
    sharedClientState: null as any,
    networkEnabled: true,
    activeTargetRefs: new Map(),
    pendingWriteResolvers: new Map(),
    sharedStateQueue: Promise.resolve(),
  };
  state.sharedClientState = new OfflineSharedClientState(
    databaseName,
    options?.synchronizeTabs === true,
    {
      onActiveTargetsChanged: (added, removed) => {
        handleSharedActiveTargetsChange(state, db, added, removed).catch(() => undefined);
      },
      onMutationState: event => {
        handleSharedMutationState(state, event).catch(() => undefined);
      },
      onQueryState: event => {
        handleSharedQueryState(state, event).catch(() => undefined);
      },
      onOnlineState: onlineState => {
        if (!state.tabCoordinator.canRunRemoteStore) {
          state.onlineStateTracker.set(onlineState);
        }
      },
      onCacheChanged: event => {
        handleSharedCacheChange(state, event).catch(() => undefined);
      },
    }
  );
  state.tabCoordinator = new OfflineTabCoordinator(
    databaseName,
    options?.synchronizeTabs === true,
    localStore.userId
  );
  state.onlineStateTracker = new OfflineOnlineStateTracker(onlineState => {
    applyOnlineStateChange(state, onlineState);
  });
  state.eventHub = new OfflineEventHub(async (target, listenOptions) => {
    await syncCurrentUserForActiveTargets(state, db);
    const forceFromCache = shouldForceSnapshotFromCache(state, target, listenOptions);
    if (target instanceof DocumentReference) {
      return state.queryEngine.getDocumentFromCache(target, forceFromCache);
    }
    return state.queryEngine.getDocumentsFromCache(target as Query<any, any>, forceFromCache);
  }, () => isConsideredOnlineForListen(state));
  state.remoteStore = new OfflineRemoteStore(
    db,
    localStore,
    (batch, _error, affectedKeys) => {
      resolvePendingWrite(state, batch.batchId);
      state.sharedClientState.updateMutationState({
        batchId: batch.batchId,
        userId: batch.userId,
        state: 'acknowledged',
        affectedPaths: ((affectedKeys as any) ?? batch.affectedKeys).map((key: OracledbDocumentKey) => key.path),
      });
      state.eventHub.emitSnapshots((affectedKeys as any) ?? batch.affectedKeys).catch(() => undefined);
      attachActiveRemoteListeners(state).catch(() => undefined);
    },
    (batch, _error, affectedKeys, rejectedBatchIds) => {
      rejectPendingWrites(state, rejectedBatchIds ?? [batch.batchId], _error);
      for (const rejectedBatchId of rejectedBatchIds ?? [batch.batchId]) {
        state.sharedClientState.updateMutationState({
          batchId: rejectedBatchId,
          userId: batch.userId,
          state: 'rejected',
          affectedPaths: ((affectedKeys as any) ?? batch.affectedKeys).map((key: OracledbDocumentKey) => key.path),
          error: _error instanceof Error ? _error.message : String(_error ?? 'Offline write was rejected by the backend'),
        });
      }
      state.eventHub.emitSnapshots((affectedKeys as any) ?? batch.affectedKeys).catch(() => undefined);
    },
    () => state.onlineStateTracker.handleRemoteAttemptStart(),
    () => state.onlineStateTracker.handleRemoteSuccess(),
    () => state.onlineStateTracker.handleRemoteFailure()
  );
  state.remoteWatch = new OfflineRemoteWatch(db);
  state.syncCoordinator = new OfflineSyncCoordinator({
    write: (mutations, source) => writeLocallyForState(state, db, mutations, source),
    listen: (target, listenOptions, observer) => listenOfflineForState(state, db, target, listenOptions, observer),
    getDocument: (ref, source = 'default') => source === 'cache'
      ? getDocumentFromCacheForState(state, db, ref)
      : readOnceViaOfflineListener(ref) as Promise<DocumentSnapshot<any, any>>,
    getDocuments: (query, source = 'default') => source === 'cache'
      ? getDocumentsFromCacheForState(state, db, query as Query<any, any>)
      : readOnceViaOfflineListener(query as Query<any, any>) as Promise<QuerySnapshot<any, any>>,
    waitForPendingWrites: () => waitForPendingWritesForState(state, db),
    resumeNetwork: () => resumeNetworkForState(state, db),
    pauseNetwork: () => pauseNetworkForState(state, db),
    hasPendingWritesForDocument: ref => hasPendingWritesForDocumentForState(state, db, ref),
    getPendingCacheSnapshotForQuery: async query => {
      const cached = await getDocumentsFromCacheForState(state, db, query as Query<any, any>);
      return cached.metadata.hasPendingWrites ? cached : null;
    },
    cacheDocumentSnapshot: snapshot => cacheDocumentSnapshotForState(state, snapshot),
    cacheQuerySnapshot: snapshot => cacheQuerySnapshotForState(state, db, snapshot),
  });
  const onConnectivityChange = (connectivityState: 'online' | 'offline') => {
    handleConnectivityChange(state, db, connectivityState).catch(() => undefined);
  };
  state.connectivityTracker.addListener(onConnectivityChange);
  const onRemoteTransportFailure = () => {
    handleRemoteTransportFailure(state);
  };
  db.eventManager?.addEventListener?.('socket error', onRemoteTransportFailure);
  db.eventManager?.addEventListener?.('socket closed', onRemoteTransportFailure);
  db.eventManager?.addEventListener?.('long polling error', onRemoteTransportFailure);
  state.unsubscribeConnectivityListener = () => {
    state.connectivityTracker.removeListener(onConnectivityChange);
    state.connectivityTracker.shutdown();
  };
  state.unsubscribeRemoteFailureListener = () => {
    db.eventManager?.removeEventListener?.('socket error', onRemoteTransportFailure);
    db.eventManager?.removeEventListener?.('socket closed', onRemoteTransportFailure);
    db.eventManager?.removeEventListener?.('long polling error', onRemoteTransportFailure);
  };
  state.sharedClientState.start(localStore.userId);
  state.tabCoordinator.setPrimaryStateListener(isPrimary => {
    handlePrimaryStateChange(state, db, isPrimary).catch(() => undefined);
  });
  state.tabCoordinator.start();
  return state;
}

function defaultPersistence(db: Oracledb, options?: OfflineOptions): OfflinePersistence {
  if (options?.persistence === 'memory') {
    return new OfflineMemoryPersistence(options.cacheSizeBytes);
  }
  const databaseName = `${db.app.options.appID ?? db.app.name}-oracledb-offline`;
  return new OfflineIndexedDbPersistence(databaseName, options?.cacheSizeBytes);
}

async function setPersistence(db: Oracledb, persistence: OfflinePersistence, options?: OfflineOptions): Promise<void> {
  const existing = OFFLINE_STATE.get(db);
  if (existing) {
    existing.unsubscribeConnectivityListener?.();
    existing.unsubscribeRemoteFailureListener?.();
    existing.onlineStateTracker.shutdown();
    existing.sharedClientState.shutdown();
    existing.tabCoordinator.shutdown();
    rejectPendingWriteCallbacks(existing, [...existing.pendingWriteResolvers.keys()], new Error('Offline persistence was replaced'));
    await existing.remoteStore.pauseNetwork();
    await existing.persistence.shutdown();
  }
  await persistence.start();
  const state = createState(db, persistence, options);
  OFFLINE_STATE.set(db, state);
  if (canUseNetwork(state)) {
    state.remoteStore.resumeNetwork(true)
      .then(() => attachActiveRemoteListeners(state))
      .catch(() => undefined);
  }
}

function getOfflineState(db: Oracledb): OfflineState {
  const state = OFFLINE_STATE.get(db);
  if (!state) {
    throw new Error('Offline support is not enabled for this OracleDB instance');
  }
  return state;
}

function maybeGetOfflineState(db: Oracledb): OfflineState | undefined {
  return OFFLINE_STATE.get(db);
}

function browserReportsOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function currentUserId(db: Oracledb): string {
  return userIdFromCurrentAuthUser(db)
    ?? userIdFromToken(() => getToken(db.app))
    ?? userIdFromPersistedAuthTokens(db)
    ?? 'anonymous';
}

function userIdFromCurrentAuthUser(db: Oracledb): string | undefined {
  let user: any = null;
  try {
    user = db.app.auth?.()?.currentUser;
  } catch {
    user = null;
  }
  if (!user) return undefined;

  const tokenUserId = userIdFromToken(() => user.__getToken?.());
  return tokenUserId ?? firstNonEmptyString(user.email, user.uid, user.user_id, user.sub);
}

function userIdFromToken(readToken: () => unknown): string | undefined {
  try {
    return userIdFromTokenValue(readToken());
  } catch {
    return undefined;
  }
}

function userIdFromPersistedAuthTokens(db: Oracledb): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const tokenKeys = new Set<string>();
  try {
    const auth = db.app.auth?.();
    if (auth?.TOKEN_KEY) tokenKeys.add(auth.TOKEN_KEY);
  } catch {
    // Ignore auth initialization errors while resolving the offline user lane.
  }

  const appId = (db.app as any)?.options?.appID;
  if (appId) tokenKeys.add(`${appId}TOKENS`);

  for (const tokenKey of tokenKeys) {
    const localUserId = userIdFromStorage(window.localStorage, tokenKey);
    if (localUserId) return localUserId;

    const sessionUserId = userIdFromStorage(window.sessionStorage, tokenKey);
    if (sessionUserId) return sessionUserId;
  }

  return undefined;
}

function userIdFromStorage(storage: Storage | undefined, tokenKey: string): string | undefined {
  try {
    const value = storage?.getItem(tokenKey);
    return value ? userIdFromTokenValue(value) : undefined;
  } catch {
    return undefined;
  }
}

function userIdFromTokenValue(value: unknown): string | undefined {
  if (!value) return undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const parsedJson = parseJsonIfObjectLike(trimmed);
    if (parsedJson !== undefined) {
      return userIdFromTokenValue(parsedJson);
    }

    const claims = parseJwtPayload(trimmed);
    return userIdFromClaims(claims);
  }

  if (typeof value !== 'object') return undefined;

  const token = value as Record<string, any>;
  return firstNonEmptyString(
    token.claims?.sub,
    token.parsedJwt?.sub,
    token.parsedJwt?.user_id,
    token.user_id,
    token.uid,
    token.sub,
    token.email
  )
    ?? userIdFromTokenValue(token.access_token)
    ?? userIdFromTokenValue(token.id_token)
    ?? userIdFromTokenValue(token.token)
    ?? userIdFromTokenValue(token.intToken);
}

function userIdFromClaims(claims: Record<string, unknown> | undefined): string | undefined {
  if (!claims) return undefined;
  return firstNonEmptyString(claims.sub, claims.user_id, claims.uid, claims.email);
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function parseJsonIfObjectLike(value: string): unknown | undefined {
  if (!value.startsWith('{') && !value.startsWith('[')) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function parseJwtPayload(token: string): Record<string, unknown> | undefined {
  const [, payload] = token.split('.');
  if (!payload) return undefined;

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    try {
      const utf8Decoded = decodeURIComponent(
        decoded
          .split('')
          .map(char => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
          .join('')
      );
      return JSON.parse(utf8Decoded);
    } catch {
      return JSON.parse(decoded);
    }
  } catch {
    return undefined;
  }
}

async function syncCurrentUser(state: OfflineState, db: Oracledb): Promise<OracledbDocumentKey[]> {
  const nextUserId = currentUserId(db);
  const previousUserId = state.localStore.userId;
  const affectedKeys = await state.localStore.setUserId(nextUserId);
  state.sharedClientState.setUserId(nextUserId);
  state.tabCoordinator.setUserId(nextUserId);
  if (previousUserId !== nextUserId) {
    rejectPendingWritesForUser(
      state,
      previousUserId,
      new Error('Offline write belongs to a previous authenticated user')
    );
  }
  return affectedKeys;
}

async function syncCurrentUserForActiveTargets(state: OfflineState, db: Oracledb): Promise<OracledbDocumentKey[]> {
  if (currentUserId(db) === state.localStore.userId) return [];
  const activeTargets = [...state.activeTargetRefs.entries()].map(([targetId, active]) => ({
    targetId,
    target: active.target,
  }));
  for (const { targetId } of activeTargets) {
    state.sharedClientState.removeLocalQueryTarget(targetId);
    const active = state.activeTargetRefs.get(targetId);
    if (active) {
      clearRemoteListenerRetry(active);
      const remoteUnsubscribe = active.remoteUnsubscribe;
      active.remoteUnsubscribe = undefined;
      remoteUnsubscribe?.();
    }
    state.activeTargetRefs.delete(targetId);
    await state.localStore.deactivateTarget(targetId);
  }
  const affectedKeys = await syncCurrentUser(state, db);
  closeRemoteTransport(state, db);
  for (const active of activeTargets) {
    const storedTarget = await state.localStore.registerTarget(buildQueryTarget(active.target));
    state.activeTargetRefs.set(storedTarget.targetId, { target: active.target, current: false });
    state.sharedClientState.addLocalQueryTarget(buildSharedTargetDescriptor(storedTarget, active.target));
  }
  if (canUseNetwork(state)) {
    await state.remoteStore.resumeNetwork(true);
    await attachActiveRemoteListeners(state);
  }
  return affectedKeys;
}

function closeRemoteTransport(state: OfflineState, db: Oracledb): void {
  state.ignoreTransportFailuresUntil = Date.now() + 2000;
  if (db.connection) {
    try {
      db.connection.close();
    } catch {
      // Ignore close errors from already-closed transports.
    }
  }
  db.connection = null;
  db.__messageQueue = [];
}

function shouldResolveWritesOnRemoteAck(db: Oracledb): boolean {
  return db._settings?.writePromiseResolution === 'remote';
}

function createPendingWritePromise(state: OfflineState, batchId: number): Promise<void> {
  return createPendingWriteResolver(state, batchId, 'write');
}

function createPendingWriteResolver(
  state: OfflineState,
  batchId: number,
  kind: PendingWriteResolver['kind']
): Promise<void> {
  return new Promise((resolve, reject) => {
    const callbacks = state.pendingWriteResolvers.get(batchId) ?? [];
    callbacks.push({ userId: state.localStore.userId, kind, resolve, reject });
    state.pendingWriteResolvers.set(batchId, callbacks);
  });
}

function resolvePendingWrite(state: OfflineState, batchId: number): void {
  const callbacks = state.pendingWriteResolvers.get(batchId) ?? [];
  state.pendingWriteResolvers.delete(batchId);
  for (const callback of callbacks) {
    callback.resolve();
  }
}

function rejectPendingWrites(state: OfflineState, batchIds: number[], error: unknown): void {
  for (const batchId of batchIds) {
    const callbacks = state.pendingWriteResolvers.get(batchId) ?? [];
    state.pendingWriteResolvers.delete(batchId);
    for (const callback of callbacks) {
      if (callback.kind === 'wait') {
        callback.resolve();
      } else {
        callback.reject(error ?? new Error('Offline write was rejected by the backend'));
      }
    }
  }
}

function rejectPendingWritesForUser(state: OfflineState, userId: string, error: unknown): void {
  const batchIds = [...state.pendingWriteResolvers.entries()]
    .filter(([, callbacks]) => callbacks.some(callback => callback.userId === userId))
    .map(([batchId]) => batchId);
  rejectPendingWriteCallbacks(state, batchIds, error, userId);
}

function rejectPendingWriteCallbacks(
  state: OfflineState,
  batchIds: number[],
  error: unknown,
  userId?: string
): void {
  for (const batchId of batchIds) {
    const callbacks = state.pendingWriteResolvers.get(batchId) ?? [];
    const remaining: PendingWriteResolver[] = [];
    for (const callback of callbacks) {
      if (userId != null && callback.userId !== userId) {
        remaining.push(callback);
        continue;
      }
      callback.reject(error);
    }
    if (remaining.length > 0) {
      state.pendingWriteResolvers.set(batchId, remaining);
    } else {
      state.pendingWriteResolvers.delete(batchId);
    }
  }
}

export function _shouldReadFromCache(db: Oracledb): boolean {
  const state = maybeGetOfflineState(db);
  return Boolean(state && (
    !state.networkEnabled ||
    state.connectivityTracker.state === 'offline' ||
    state.onlineStateTracker.state === 'offline' ||
    !state.tabCoordinator.canRunRemoteStore
  ));
}

export function _isOfflineEnabled(db: Oracledb): boolean {
  return maybeGetOfflineState(db) != null;
}

export function _assertServerReadable(db: Oracledb): void {
  const state = maybeGetOfflineState(db);
  if (state && !state.networkEnabled) {
    throw new Error('Network is disabled for this OracleDB instance');
  }
  if (
    (state && (state.connectivityTracker.state === 'offline' || state.onlineStateTracker.state === 'offline')) ||
    (!state && browserReportsOffline())
  ) {
    throw new Error('Network is unavailable');
  }
}

export function _getDocFromCacheIfEnabled<AppModelType>(
  ref: DocumentReference<AppModelType>
): Promise<DocumentSnapshot<AppModelType>> | null {
  const state = maybeGetOfflineState(ref.oracledb);
  return state ? state.syncCoordinator.getDocument(ref, 'cache') : null;
}

export function _getDocsFromCacheIfEnabled<AppModelType, DbModelType>(
  query: Query<AppModelType, any> | CollectionReference<AppModelType, any> | DualityViewColReference<AppModelType>
): Promise<QuerySnapshot<AppModelType, any>> | null {
  const db = getDbFromRefOrQuery(query);
  const state = maybeGetOfflineState(db);
  return state ? state.syncCoordinator.getDocuments(query as Query<AppModelType, any>, 'cache') : null;
}

function getDocumentFromCacheForState<AppModelType>(
  state: OfflineState,
  db: Oracledb,
  ref: DocumentReference<AppModelType>
): Promise<DocumentSnapshot<AppModelType>> {
  return syncCurrentUserForActiveTargets(state, db)
    .then(() => state.queryEngine.getDocumentFromCache(ref, true));
}

function getDocumentsFromCacheForState<AppModelType>(
  state: OfflineState,
  db: Oracledb,
  query: Query<AppModelType, any> | CollectionReference<AppModelType, any> | DualityViewColReference<AppModelType>
): Promise<QuerySnapshot<AppModelType, any>> {
  return syncCurrentUserForActiveTargets(state, db)
    .then(() => state.queryEngine.getDocumentsFromCache(query as Query<AppModelType, any>, true));
}

export function _listenOfflineIfEnabled<AppModelType>(
  target: Query<AppModelType, any> | CollectionReference<AppModelType, any> | DocumentReference<AppModelType, any>,
  options: ListenOptions,
  observer: ListenObserver<QuerySnapshot<AppModelType, any> | DocumentSnapshot<AppModelType, any>>
): Unsubscribe | null {
  const db = getDbFromRefOrQuery(target);
  const state = maybeGetOfflineState(db);
  if (!state) return null;
  return state.syncCoordinator.listen(target, options, observer);
}

function listenOfflineForState<AppModelType>(
  state: OfflineState,
  db: Oracledb,
  target: Query<AppModelType, any> | CollectionReference<AppModelType, any> | DocumentReference<AppModelType, any>,
  options: ListenOptions,
  observer: ListenObserver<QuerySnapshot<AppModelType, any> | DocumentSnapshot<AppModelType, any>>
): Unsubscribe {
  assertValidListenSource(options);
  const listenToRemote = shouldListenToRemote(options);
  let targetId: number | null = null;
  let cancelled = false;
  syncCurrentUserForActiveTargets(state, db)
    .then(affectedKeys => {
      if (affectedKeys.length > 0) {
        state.eventHub.emitSnapshots(affectedKeys).catch(() => undefined);
      }
      return state.localStore.registerTarget(buildQueryTarget(target));
    })
    .then(storedTarget => {
      targetId = storedTarget.targetId;
      if (cancelled) {
        state.localStore.deactivateTarget(storedTarget.targetId).catch(() => undefined);
        return;
      }
      if (!listenToRemote) return;
      state.sharedClientState.addLocalQueryTarget(buildSharedTargetDescriptor(storedTarget, target));
      state.activeTargetRefs.set(storedTarget.targetId, { target: target as any, current: false, shared: false });
      if (canUseNetwork(state)) {
        attachRemoteListener(state, storedTarget.targetId);
      }
    })
    .catch(error => observer.error?.(error as Error));
  const unsubscribe = state.eventHub.listen(target, options, observer);
  return () => {
    cancelled = true;
    unsubscribe();
    if (targetId != null) {
      state.sharedClientState.removeLocalQueryTarget(targetId);
      const active = state.activeTargetRefs.get(targetId);
      const stillActiveElsewhere = state.sharedClientState.isActiveQueryTarget(targetId);
      if (stillActiveElsewhere) {
        if (active) {
          active.shared = true;
        }
        return;
      }
      if (active) {
        clearRemoteListenerRetry(active);
      }
      const remoteUnsubscribe = active?.remoteUnsubscribe;
      if (active) {
        active.remoteUnsubscribe = undefined;
      }
      remoteUnsubscribe?.();
      state.activeTargetRefs.delete(targetId);
      state.localStore.deactivateTarget(targetId).catch(() => undefined);
    }
  };
}

export async function _hasPendingWritesForDocument(ref: DocumentReference<any, any>): Promise<boolean> {
  const state = maybeGetOfflineState(ref.oracledb);
  if (!state) return false;
  return state.syncCoordinator.hasPendingWritesForDocument(ref);
}

async function hasPendingWritesForDocumentForState(
  state: OfflineState,
  db: Oracledb,
  ref: DocumentReference<any, any>
): Promise<boolean> {
  await syncCurrentUserForActiveTargets(state, db);
  return state.localStore.hasPendingWrites(OracledbDocumentKey.fromPath(ref.path));
}

export async function _getPendingCacheSnapshotForQuery<AppModelType, DbModelType>(
  query: Query<AppModelType, any> | CollectionReference<AppModelType, any> | DualityViewColReference<AppModelType>
): Promise<QuerySnapshot<AppModelType, any> | null> {
  const db = getDbFromRefOrQuery(query);
  const state = maybeGetOfflineState(db);
  return state ? state.syncCoordinator.getPendingCacheSnapshotForQuery(query as Query<AppModelType, any>) : null;
}

export function _getDocViaSnapshotIfEnabled<AppModelType>(
  ref: DocumentReference<AppModelType>
): Promise<DocumentSnapshot<AppModelType>> | null {
  const state = maybeGetOfflineState(ref.oracledb);
  if (!state) return null;
  return state.syncCoordinator.getDocument(ref, 'default');
}

export function _getDocsViaSnapshotIfEnabled<AppModelType, DbModelType>(
  query: Query<AppModelType, any> | CollectionReference<AppModelType, any>
): Promise<QuerySnapshot<AppModelType, any>> | null {
  const db = getDbFromRefOrQuery(query);
  const state = maybeGetOfflineState(db);
  if (!state) return null;
  return state.syncCoordinator.getDocuments(query as Query<AppModelType, any>, 'default');
}

export async function _writeLocallyIfEnabled(
  db: Oracledb,
  mutations: OfflineWriteMutation[],
  source: OfflineWriteBatchSource = 'individual'
): Promise<void> {
  const state = maybeGetOfflineState(db);
  if (!state) return;
  return state.syncCoordinator.write(mutations, source);
}

async function writeLocallyForState(
  state: OfflineState,
  db: Oracledb,
  mutations: OfflineWriteMutation[],
  source: OfflineWriteBatchSource = 'individual'
): Promise<void> {
  const userAffectedKeys = await syncCurrentUserForActiveTargets(state, db);
  if (userAffectedKeys.length > 0) {
    state.eventHub.emitSnapshots(userAffectedKeys).catch(() => undefined);
  }
  const result = await state.localStore.writeLocally(mutations, source);
  state.sharedClientState.addPendingMutation(
    result.batchId,
    state.localStore.userId,
    result.affectedKeys.map(key => key.path)
  );
  const remoteAckPromise = shouldResolveWritesOnRemoteAck(db)
    ? createPendingWritePromise(state, result.batchId)
    : null;
  state.eventHub.emitSnapshots(result.affectedKeys).catch(() => undefined);
  if (canUseNetwork(state)) {
    state.remoteStore.resumeNetwork()
      .then(() => attachActiveRemoteListeners(state))
      .catch(() => undefined);
  }
  if (remoteAckPromise) {
    await remoteAckPromise;
  }
}

/**
 * Waits until all writes queued by this client before the call have either
 * been acknowledged or rejected by the remote service.
 *
 * @param {Oracledb} db - The OracleDB instance whose pending writes are observed.
 * @returns {Promise<void>} A promise that resolves after the queued writes are acknowledged.
 * @example
 * ```ts
 * await setDoc(doc(db, "tasks", "task-1"), { completed: true });
 * await waitForPendingWrites(db);
 * ```
 */
export async function waitForPendingWrites(db: Oracledb): Promise<void> {
  const state = maybeGetOfflineState(db);
  if (!state) return;
  return state.syncCoordinator.waitForPendingWrites();
}

async function waitForPendingWritesForState(state: OfflineState, db: Oracledb): Promise<void> {
  await syncCurrentUserForActiveTargets(state, db);
  const highestBatchId = await state.localStore.getHighestUnacknowledgedBatchId();
  if (highestBatchId == null) return;
  const promise = createPendingWriteResolver(state, highestBatchId, 'wait');
  const stillPending = (await state.localStore.getAllMutationBatches())
    .some(batch => batch.batchId === highestBatchId);
  if (!stillPending) {
    resolvePendingWrite(state, highestBatchId);
  } else if (canUseNetwork(state)) {
    state.remoteStore.resumeNetwork()
      .then(() => attachActiveRemoteListeners(state))
      .catch(() => undefined);
  }
  await promise;
}

function readOnceViaOfflineListener(
  target: Query<any, any> | CollectionReference<any, any> | DocumentReference<any, any>
): Promise<QuerySnapshot<any, any> | DocumentSnapshot<any, any>> {
  return new Promise((resolve, reject) => {
    let unsubscribe: Unsubscribe = () => undefined;
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      try {
        unsubscribe();
      } catch {
        // Ignore unsubscribe errors from legacy listener implementations.
      }
      callback();
    };
    const offlineUnsubscribe = _listenOfflineIfEnabled(
      target,
      { includeMetadataChanges: true, waitForSyncWhenOnline: true },
      {
        next: snapshot => finish(() => resolve(snapshot)),
        error: error => finish(() => reject(error)),
      }
    );
    unsubscribe = offlineUnsubscribe ?? (() => undefined);
  });
}

/**
 * Enables local persistence, cached reads, queued writes, and synchronization
 * for an OracleDB instance. IndexedDB persistence is used unless options
 * select memory persistence.
 *
 * @param {Oracledb} db - The OracleDB instance to configure for offline operation.
 * @param {OfflineOptions} [options] - Persistence kind, cache size, and tab-synchronization options.
 * @returns {Promise<void>} A promise that resolves when local persistence is ready.
 * @example
 * ```ts
 * await enableOffline(db, { persistence: "indexeddb", cacheSizeBytes: 10 * 1024 * 1024 });
 * ```
 */
export function enableOffline(db: Oracledb, options?: OfflineOptions): Promise<void> {
  return setPersistence(db, defaultPersistence(db, options), options);
}

/**
 * Enables local persistence backed by IndexedDB for an OracleDB instance.
 *
 * @param {Oracledb} db - The OracleDB instance to configure.
 * @returns {Promise<void>} A promise that resolves when IndexedDB persistence is ready.
 * @example
 * ```ts
 * await enableIndexedDbPersistence(db);
 * ```
 */
export function enableIndexedDbPersistence(db: Oracledb): Promise<void> {
  const databaseName = `${db.app.options.appID ?? db.app.name}-oracledb-offline`;
  return setPersistence(db, new OfflineIndexedDbPersistence(databaseName));
}

/**
 * Enables local persistence held only in memory for an OracleDB instance.
 * Cached data is discarded when the application process ends.
 *
 * @param {Oracledb} db - The OracleDB instance to configure.
 * @returns {Promise<void>} A promise that resolves when memory persistence is ready.
 * @example
 * ```ts
 * await enableMemoryPersistence(db);
 * ```
 */
export function enableMemoryPersistence(db: Oracledb): Promise<void> {
  return setPersistence(db, new OfflineMemoryPersistence());
}

/**
 * Creates options for an IndexedDB-backed local cache.
 *
 * @param {PersistentLocalCacheOptions} [options] - Optional cache-size and tab-synchronization settings.
 * @returns {OfflineOptions} Options that can be passed to {@link enableOffline}.
 * @example
 * ```ts
 * await enableOffline(db, persistentLocalCache({ synchronizeTabs: true }));
 * ```
 */
export function persistentLocalCache(options: PersistentLocalCacheOptions = {}): OfflineOptions {
  return {
    persistence: 'indexeddb',
    cacheSizeBytes: options.cacheSizeBytes,
    synchronizeTabs: options.synchronizeTabs,
  };
}

/**
 * Removes all locally persisted IndexedDB data for an OracleDB instance.
 *
 * @param {Oracledb} db - The OracleDB instance whose persisted data is removed.
 * @returns {Promise<void>} A promise that resolves after the persisted data is cleared.
 * @example
 * ```ts
 * await clearIndexedDbPersistence(db);
 * ```
 */
export async function clearIndexedDbPersistence(db: Oracledb): Promise<void> {
  const state = OFFLINE_STATE.get(db);
  if (state) {
    await state.persistence.clear();
    return;
  }
  const databaseName = `${db.app.options.appID ?? db.app.name}-oracledb-offline`;
  await new OfflineIndexedDbPersistence(databaseName).clear();
}

/**
 * Resumes remote reads, listener synchronization, and queued-write delivery
 * after network access was disabled.
 *
 * @param {Oracledb} db - The offline-enabled OracleDB instance to resume.
 * @returns {Promise<void>} A promise that resolves after synchronization is resumed.
 * @example
 * ```ts
 * await enableNetwork(db);
 * ```
 */
export async function enableNetwork(db: Oracledb): Promise<void> {
  const state = getOfflineState(db);
  return state.syncCoordinator.resumeNetwork();
}

async function resumeNetworkForState(state: OfflineState, db: Oracledb): Promise<void> {
  state.networkEnabled = true;
  state.tabCoordinator.setNetworkEnabled(true);
  await refreshPersistenceFromStorage(state);
  state.onlineStateTracker.set(state.connectivityTracker.state === 'offline' ? 'offline' : 'unknown');
  if (canUseNetwork(state)) {
    await syncSharedActiveTargetsIntoPrimary(state, db);
    await state.remoteStore.resumeNetwork(true);
    await attachActiveRemoteListeners(state);
  }
  await state.eventHub.emitSnapshots();
}

/**
 * Suspends remote reads, listener synchronization, and queued-write delivery
 * while retaining access to locally cached data.
 *
 * @param {Oracledb} db - The offline-enabled OracleDB instance to pause.
 * @returns {Promise<void>} A promise that resolves after network activity is paused.
 * @example
 * ```ts
 * await disableNetwork(db);
 * const snapshot = await getDocFromCache(doc(db, "tasks", "task-1"));
 * ```
 */
export async function disableNetwork(db: Oracledb): Promise<void> {
  const state = getOfflineState(db);
  return state.syncCoordinator.pauseNetwork();
}

async function pauseNetworkForState(state: OfflineState, db: Oracledb): Promise<void> {
  state.networkEnabled = false;
  state.tabCoordinator.setNetworkEnabled(false);
  state.ignoreTransportFailuresUntil = Date.now() + 2000;
  detachRemoteListeners(state);
  closeRemoteTransport(state, db);
  await state.remoteStore.pauseNetwork();
  state.onlineStateTracker.set('offline');
  await state.eventHub.emitSnapshots();
}

/**
 * Reads one document exclusively from the enabled local cache.
 *
 * @template AppModelType - The application model type of the document.
 * @param {DocumentReference<AppModelType>} ref - The document reference to read.
 * @returns {Promise<DocumentSnapshot<AppModelType>>} A promise containing the cached document snapshot.
 * @example
 * ```ts
 * const snapshot = await getDocFromCache(doc(db, "tasks", "task-1"));
 * if (snapshot.exists()) console.log(snapshot.data());
 * ```
 */
export function getDocFromCache<AppModelType>(
  ref: DocumentReference<AppModelType>
): Promise<DocumentSnapshot<AppModelType>> {
  const db = getDbFromRefOrQuery(ref);
  return getOfflineState(db).syncCoordinator.getDocument(ref, 'cache');
}

/**
 * Reads documents for a query or collection exclusively from the enabled local cache.
 *
 * @template AppModelType - The application model type of the returned documents.
 * @template DbModelType - The stored model type of the returned documents.
 * @param {Query<AppModelType, DbModelType> | CollectionReference<AppModelType, DbModelType> | DualityViewColReference<AppModelType>} query - The query or collection to read.
 * @returns {Promise<QuerySnapshot<AppModelType, DbModelType>>} A promise containing the cached query snapshot.
 * @example
 * ```ts
 * const snapshot = await getDocsFromCache(collection(db, "tasks"));
 * console.log(snapshot.docs.map(item => item.data()));
 * ```
 */
export function getDocsFromCache<AppModelType, DbModelType>(
  query: Query<AppModelType, any> | CollectionReference<AppModelType, any> | DualityViewColReference<AppModelType>
): Promise<QuerySnapshot<AppModelType, any>> {
  const db = getDbFromRefOrQuery(query);
  return getOfflineState(db).syncCoordinator.getDocuments(query as Query<AppModelType, any>, 'cache');
}

export async function _cacheDocumentSnapshot(snapshot: DocumentSnapshot<any, any>): Promise<void> {
  const ref = snapshot.ref as DocumentReference<any, any> | undefined;
  if (!ref?.oracledb || !OFFLINE_STATE.has(ref.oracledb)) return;
  const state = OFFLINE_STATE.get(ref.oracledb)!;
  return state.syncCoordinator.cacheDocumentSnapshot(snapshot);
}

async function cacheDocumentSnapshotForState(
  state: OfflineState,
  snapshot: DocumentSnapshot<any, any>
): Promise<void> {
  const ref = snapshot.ref as DocumentReference<any, any> | undefined;
  if (!ref) return;
  await state.localStore.saveRemoteDocument(cachedDocumentFromSnapshot(snapshot, OracledbDocumentKey.fromPath(ref.path)));
}

export async function _cacheQuerySnapshot(snapshot: QuerySnapshot<any, any>): Promise<void> {
  if (isQuerySnapshotFromFailedRequest(snapshot)) return;
  const db = getDbFromRefOrQuery(snapshot.query);
  const state = maybeGetOfflineState(db);
  if (!state) return;
  return state.syncCoordinator.cacheQuerySnapshot(snapshot);
}

async function cacheQuerySnapshotForState(
  state: OfflineState,
  db: Oracledb,
  snapshot: QuerySnapshot<any, any>
): Promise<void> {
  if (isQuerySnapshotFromFailedRequest(snapshot)) return;
  await syncCurrentUserForActiveTargets(state, db);
  const documents = snapshot.docs.map(doc =>
    cachedDocumentFromSnapshot(doc, OracledbDocumentKey.fromPath(doc.ref.path))
  );
  const storedTarget = await state.localStore.registerTarget(buildQueryTarget(snapshot.query as any));
  const affected = await state.localStore.updateTargetDocuments(
    storedTarget,
    documents,
    isCompleteCollectionTarget(snapshot.query as any)
  );
  if (!state.activeTargetRefs.has(storedTarget.targetId) &&
    !state.sharedClientState.isActiveQueryTarget(storedTarget.targetId)) {
    await state.localStore.deactivateTarget(storedTarget.targetId);
  }
  if (affected.length > 0) {
    await state.eventHub.emitSnapshots(affected);
  }
}

function cachedDocumentFromSnapshot(
  snapshot: DocumentSnapshot<any, any>,
  fallbackKey?: OracledbDocumentKey
): OfflineCachedDocument {
  const key = fallbackKey ?? OracledbDocumentKey.fromPath(snapshot.ref.path);
  return {
    key,
    data: snapshot.exists() ? snapshot.data() as any : null,
    version: new OracledbDocumentVersion((snapshot as any).__version ?? ''),
    updateTime: (snapshot as any)._otherMetadata?.updateTime ??
      (snapshot as any)._otherMetadata?.LAST_MODIFIED ??
      undefined,
    commitTime: (snapshot as any)._otherMetadata?.commitTime ?? undefined,
    readTime: (snapshot as any)._otherMetadata?.ASOF ?? undefined,
    documentState: snapshot.exists() ? 'found' : 'noDocument',
    hasLocalMutations: false,
    hasCommittedMutations: false,
  };
}

export async function _ensureDocumentCachedForWrite(ref: DocumentReference<any, any>): Promise<void> {
  const state = maybeGetOfflineState(ref.oracledb);
  if (!state) return;
  const key = OracledbDocumentKey.fromPath(ref.path);
  const localDocument = await state.localStore.getLocalDocument(key);
  if (localDocument && localDocument.documentState !== 'noDocument' && localDocument.data != null) return;
  if (
    !state.networkEnabled ||
    state.connectivityTracker.state === 'offline' ||
    state.onlineStateTracker.state === 'offline'
  ) {
    throw new Error(`Document ${ref.path} is not available in cache`);
  }
  const snap = await ref.get() as DocumentSnapshot<any, any>;
  await _cacheDocumentSnapshot(snap);
  if (!snap.exists()) {
    throw new Error(`Document ${ref.path} does not exist`);
  }
}

export async function _assertDocumentDoesNotExistInCache(ref: DocumentReference<any, any>): Promise<void> {
  const state = maybeGetOfflineState(ref.oracledb);
  if (!state) return;
  await syncCurrentUserForActiveTargets(state, ref.oracledb);
  await refreshPersistenceFromStorage(state);
  const key = OracledbDocumentKey.fromPath(ref.path);
  const localDocument = await state.localStore.getLocalDocument(key);
  if (documentExistsInLocalView(state, key.path, localDocument)) {
    throw new Error(`Document ${ref.path} already exists in cache`);
  }
}

function documentExistsInLocalView(
  state: OfflineState,
  documentPath: string,
  localDocument: OfflineCachedDocument | null
): boolean {
  if (localDocument && localDocument.documentState !== 'noDocument' && localDocument.data != null) {
    return true;
  }
  if (state.eventHub.hasDocumentInActiveSnapshot(documentPath)) {
    return true;
  }
  return [...state.persistence.targetDocuments.values()].some(targetDocument =>
    targetDocument?.documentPath === documentPath
  );
}

function buildQueryTarget(
  target: Query<any, any> | CollectionReference<any, any> | DocumentReference<any, any>
) {
  const canonicalId = canonicalIdForTarget(target);
  if (target instanceof DocumentReference) {
    return {
      canonicalQuery: canonicalId,
      canonicalId,
      targetType: 'document' as const,
      path: target.path,
      filters: [],
      orderBy: [],
      limit: null,
    };
  }
  const queryLike = target as any;
  return {
    canonicalQuery: canonicalId,
    canonicalId,
    targetType: 'query' as const,
    path: Array.isArray(queryLike._path) ? queryLike._path.join('/') : '',
    filters: queryLike._conditions ?? [],
    orderBy: queryLike._explicitOrder ?? [],
    limit: queryLike._limit ?? null,
  };
}

async function attachActiveRemoteListeners(state: OfflineState): Promise<void> {
  for (const targetId of state.activeTargetRefs.keys()) {
    attachRemoteListener(state, targetId);
  }
}

function attachRemoteListener(state: OfflineState, targetId: number): void {
  const active = state.activeTargetRefs.get(targetId);
  if (!active || active.remoteUnsubscribe) return;
  if (!canUseNetwork(state)) {
    return;
  }
  const storedTarget = state.localStore.getActiveTargets().find(item => item.targetId === targetId) ??
    state.localStore.findTargetForCanonical(canonicalIdForTarget(active.target));
  if (!storedTarget) return;
  clearRemoteListenerRetry(active);
  state.onlineStateTracker.handleRemoteAttemptStart();
  active.remoteUnsubscribe = state.remoteWatch.listen(
    active.target,
    storedTarget,
    {
      nextSnapshot: (snapshot: DocumentSnapshot<any, any> | QuerySnapshot<any, any>) => {
        active.retryAttempts = 0;
        state.onlineStateTracker.handleRemoteSuccess();
        cacheTargetSnapshot(state, targetId, active.target, snapshot).catch(() => undefined);
      },
      nextDocumentChange: (change: OfflineRemoteWatchDocumentChange) => {
        active.retryAttempts = 0;
        state.onlineStateTracker.handleRemoteSuccess();
        cacheRemoteWatchDocumentChange(state, targetId, change).catch(() => undefined);
      },
      error: (_error: unknown) => {
        if (!active.remoteUnsubscribe) return;
        const remoteUnsubscribe = active.remoteUnsubscribe;
        active.remoteUnsubscribe = undefined;
        remoteUnsubscribe();
        state.onlineStateTracker.handleRemoteFailure();
        scheduleRemoteListenerRetry(state, targetId);
      },
    }
  );
}

async function cacheRemoteWatchDocumentChange(
  state: OfflineState,
  targetId: number,
  change: OfflineRemoteWatchDocumentChange
): Promise<void> {
  const storedTarget = state.localStore.getActiveTargets().find(item => item.targetId === targetId);
  if (!storedTarget) return;
  const document: OfflineCachedDocument = {
    key: change.key,
    data: change.data,
    version: new OracledbDocumentVersion(change.version ?? ''),
    updateTime: change.updateTime,
    commitTime: change.commitTime,
    readTime: change.readTime,
    documentState: change.data == null ? 'noDocument' : 'found',
    hasLocalMutations: false,
    hasCommittedMutations: false,
  };
  const belongsToTarget = remoteDocumentBelongsToTarget(storedTarget, document);
  const affected = await state.localStore.applyRemoteDocumentChangeToTarget(storedTarget, document, belongsToTarget);
  markTargetCurrent(state, targetId);
  if (affected.length === 0) {
    return;
  }
  state.sharedClientState.updateQueryState({
    targetId,
    userId: state.localStore.userId,
    state: 'current',
    affectedPaths: affected.map(key => key.path),
  });
  state.sharedClientState.notifyCacheChanged({
    userId: state.localStore.userId,
    targetId,
    affectedPaths: affected.map(key => key.path),
  });
  await state.eventHub.emitSnapshots(affected);
}

function remoteDocumentBelongsToTarget(target: OfflineQueryTarget, document: OfflineCachedDocument): boolean {
  if (document.data == null || document.documentState === 'noDocument') {
    return false;
  }
  if (target.targetType === 'document') {
    return document.key.path === target.path;
  }
  const targetPath = target.path ?? '';
  const targetDepth = targetPath ? targetPath.split('/').filter(Boolean).length + 1 : 1;
  const documentSegments = document.key.path.split('/').filter(Boolean);
  if (targetPath && !document.key.path.startsWith(`${targetPath}/`)) {
    return false;
  }
  if (documentSegments.length !== targetDepth) {
    return false;
  }
  return matchesQueryFilters(document.data, target.filters ?? []);
}

function detachRemoteListeners(state: OfflineState, resetCurrent = true): void {
  for (const active of state.activeTargetRefs.values()) {
    clearRemoteListenerRetry(active);
    const remoteUnsubscribe = active.remoteUnsubscribe;
    active.remoteUnsubscribe = undefined;
    remoteUnsubscribe?.();
    if (resetCurrent) {
      active.current = false;
    }
  }
}

async function cacheTargetSnapshot(
  state: OfflineState,
  targetId: number,
  target: SnapshotTarget,
  snapshot: DocumentSnapshot<any, any> | QuerySnapshot<any, any>
): Promise<void> {
  if (snapshot instanceof QuerySnapshot && isQuerySnapshotFromFailedRequest(snapshot)) return;
  const storedTarget = state.localStore.getActiveTargets().find(item => item.targetId === targetId) ??
    state.localStore.findTargetForCanonical(canonicalIdForTarget(target));
  if (!storedTarget) return;
  if (snapshot instanceof DocumentSnapshot) {
    const key = OracledbDocumentKey.fromPath((target as DocumentReference<any, any>).path);
    const document = cachedDocumentFromSnapshot(snapshot, key);
    const affected = await state.localStore.updateTargetDocuments(
      storedTarget,
      [document],
      true
    );
    markTargetCurrent(state, targetId);
    state.sharedClientState.updateQueryState({
      targetId,
      userId: state.localStore.userId,
      state: 'current',
      affectedPaths: (affected.length > 0 ? affected : [key]).map(item => item.path),
    });
    state.sharedClientState.notifyCacheChanged({
      userId: state.localStore.userId,
      targetId,
      affectedPaths: (affected.length > 0 ? affected : [key]).map(item => item.path),
    });
    await state.eventHub.emitSnapshots(affected.length > 0 ? affected : [key]);
    return;
  }
  const documents = snapshot.docs.map(doc =>
    cachedDocumentFromSnapshot(doc, OracledbDocumentKey.fromPath(doc.ref.path))
  );
  const affected = await state.localStore.updateTargetDocuments(
    storedTarget,
    documents,
    isCompleteCollectionTarget(target)
  );
  markTargetCurrent(state, targetId);
  state.sharedClientState.updateQueryState({
    targetId,
    userId: state.localStore.userId,
    state: 'current',
    affectedPaths: affected.map(key => key.path),
  });
  state.sharedClientState.notifyCacheChanged({
    userId: state.localStore.userId,
    targetId,
    affectedPaths: affected.map(key => key.path),
  });
  await state.eventHub.emitSnapshots(affected);
}

function canUseNetwork(state: OfflineState): boolean {
  return state.networkEnabled &&
    state.connectivityTracker.state === 'online' &&
    state.tabCoordinator.canRunRemoteStore;
}

function isConsideredOnlineForListen(state: OfflineState): boolean {
  return canUseNetwork(state) && state.onlineStateTracker.state !== 'offline';
}

function shouldListenToRemote(options?: ListenOptions): boolean {
  return options?.source !== 'cache';
}

function shouldForceSnapshotFromCache(
  state: OfflineState,
  target: SnapshotTarget,
  options?: ListenOptions
): boolean {
  if (options?.source === 'cache') return true;
  if (!canUseNetwork(state)) return true;
  if (state.onlineStateTracker.state === 'offline') return true;
  const active = activeTargetForTarget(state, target);
  return active?.current !== true;
}

function activeTargetForTarget(state: OfflineState, target: SnapshotTarget): ActiveTargetRef | undefined {
  const storedTarget = state.localStore.findTargetForCanonical(canonicalIdForTarget(target));
  if (!storedTarget) return undefined;
  return state.activeTargetRefs.get(storedTarget.targetId);
}

function markTargetCurrent(state: OfflineState, targetId: number): void {
  const active = state.activeTargetRefs.get(targetId);
  if (active) {
    active.current = true;
  }
}

function applyOnlineStateChange(state: OfflineState, onlineState: OfflineOnlineState): void {
  if (onlineState === 'offline') {
    for (const active of state.activeTargetRefs.values()) {
      active.current = false;
    }
  }
  if (state.tabCoordinator?.canRunRemoteStore) {
    state.sharedClientState.setOnlineState(onlineState);
  }
  state.eventHub?.emitSnapshots().catch(() => undefined);
}

function handleRemoteTransportFailure(state: OfflineState): void {
  if ((state.ignoreTransportFailuresUntil ?? 0) > Date.now()) {
    return;
  }
  state.onlineStateTracker.handleRemoteFailure();
  detachRemoteListeners(state, false);
  for (const targetId of state.activeTargetRefs.keys()) {
    scheduleRemoteListenerRetry(state, targetId);
  }
  state.eventHub.emitSnapshots().catch(() => undefined);
}

async function handleConnectivityChange(
  state: OfflineState,
  db: Oracledb,
  connectivityState: 'online' | 'offline'
): Promise<void> {
  if (connectivityState === 'offline') {
    state.ignoreTransportFailuresUntil = Date.now() + 2000;
    detachRemoteListeners(state);
    closeRemoteTransport(state, db);
    await state.remoteStore.pauseNetwork();
    state.onlineStateTracker.set('offline');
    await state.eventHub.emitSnapshots();
    return;
  }
  if (!state.networkEnabled) {
    await state.eventHub.emitSnapshots();
    return;
  }
  await restartNetworkForConnectivityChange(state);
}

async function restartNetworkForConnectivityChange(state: OfflineState): Promise<void> {
  state.onlineStateTracker.set('unknown');
  detachRemoteListeners(state, false);
  await state.remoteStore.pauseNetwork();
  if (canUseNetwork(state)) {
    await state.remoteStore.resumeNetwork(true);
    await attachActiveRemoteListeners(state);
  }
  await state.eventHub.emitSnapshots();
}

function scheduleRemoteListenerRetry(state: OfflineState, targetId: number): void {
  const active = state.activeTargetRefs.get(targetId);
  if (!active || active.retryTimer || active.remoteUnsubscribe || !canUseNetwork(state)) return;
  const attempts = active.retryAttempts ?? 0;
  const delayMs = Math.min(1000 * 2 ** attempts, 60000);
  active.retryAttempts = attempts + 1;
  active.retryTimer = setTimeout(() => {
    active.retryTimer = null;
    if (canUseNetwork(state)) {
      attachRemoteListener(state, targetId);
    }
  }, delayMs);
}

function clearRemoteListenerRetry(active: ActiveTargetRef): void {
  if (active.retryTimer) {
    clearTimeout(active.retryTimer);
    active.retryTimer = null;
  }
}

async function handlePrimaryStateChange(state: OfflineState, db: Oracledb, isPrimary: boolean): Promise<void> {
  if (!isPrimary) {
    detachRemoteListeners(state, false);
    await state.remoteStore.pauseNetwork();
    await state.eventHub.emitSnapshots();
    return;
  }
  await refreshPersistenceFromStorage(state);
  await syncSharedActiveTargetsIntoPrimary(state, db);
  if (canUseNetwork(state)) {
    await state.remoteStore.resumeNetwork(true);
    await attachActiveRemoteListeners(state);
  }
  await state.eventHub.emitSnapshots();
}

async function handleSharedActiveTargetsChange(
  state: OfflineState,
  db: Oracledb,
  added: OfflineSharedTargetDescriptor[],
  removed: number[]
): Promise<void> {
  return enqueueSharedStateUpdate(state, async () => {
    await refreshPersistenceFromStorage(state);
    for (const targetId of removed) {
      const active = state.activeTargetRefs.get(targetId);
      if (!active || active.shared !== true || state.sharedClientState.isActiveQueryTarget(targetId)) {
        continue;
      }
      clearRemoteListenerRetry(active);
      const remoteUnsubscribe = active.remoteUnsubscribe;
      active.remoteUnsubscribe = undefined;
      remoteUnsubscribe?.();
      state.activeTargetRefs.delete(targetId);
      await state.localStore.deactivateTarget(targetId);
    }
    for (const descriptor of added) {
      if (descriptor.userId !== state.localStore.userId) continue;
      if (!state.activeTargetRefs.has(descriptor.targetId)) {
        state.activeTargetRefs.set(descriptor.targetId, {
          target: rebuildTargetFromSharedDescriptor(db, descriptor),
          current: false,
          shared: true,
        });
      }
    }
    if (canUseNetwork(state)) {
      await state.remoteStore.resumeNetwork();
      await attachActiveRemoteListeners(state);
    }
  });
}

async function syncSharedActiveTargetsIntoPrimary(state: OfflineState, db: Oracledb): Promise<void> {
  for (const descriptor of state.sharedClientState.getAllActiveTargetDescriptors()) {
    if (descriptor.userId !== state.localStore.userId) continue;
    if (!state.activeTargetRefs.has(descriptor.targetId)) {
      state.activeTargetRefs.set(descriptor.targetId, {
        target: rebuildTargetFromSharedDescriptor(db, descriptor),
        current: false,
        shared: true,
      });
    }
  }
}

async function handleSharedMutationState(state: OfflineState, event: OfflineSharedMutationEvent): Promise<void> {
  return enqueueSharedStateUpdate(state, async () => {
    if (event.userId !== state.localStore.userId) return;
    await refreshPersistenceFromStorage(state);
    const affectedKeys = event.affectedPaths.map(path => OracledbDocumentKey.fromPath(path));
    if (event.state === 'pending') {
      await state.eventHub.emitSnapshots(affectedKeys);
      if (canUseNetwork(state)) {
        await state.remoteStore.resumeNetwork();
        await attachActiveRemoteListeners(state);
      }
      return;
    }
    if (event.state === 'acknowledged') {
      resolvePendingWrite(state, event.batchId);
    } else {
      rejectPendingWrites(state, [event.batchId], new Error(event.error ?? 'Offline write was rejected by the backend'));
    }
    await state.eventHub.emitSnapshots(affectedKeys);
  });
}

async function handleSharedQueryState(state: OfflineState, event: OfflineSharedQueryEvent): Promise<void> {
  return enqueueSharedStateUpdate(state, async () => {
    if (event.userId !== state.localStore.userId) return;
    await refreshPersistenceFromStorage(state);
    const active = state.activeTargetRefs.get(event.targetId);
    if (active) {
      active.current = event.state === 'current';
    }
    await state.eventHub.emitSnapshots(event.affectedPaths.map(path => OracledbDocumentKey.fromPath(path)));
  });
}

async function handleSharedCacheChange(state: OfflineState, event: OfflineSharedCacheEvent): Promise<void> {
  return enqueueSharedStateUpdate(state, async () => {
    if (event.userId !== state.localStore.userId) return;
    await refreshPersistenceFromStorage(state);
    await state.eventHub.emitSnapshots(event.affectedPaths.map(path => OracledbDocumentKey.fromPath(path)));
  });
}

async function refreshPersistenceFromStorage(state: OfflineState): Promise<void> {
  await state.persistence.refreshFromStorage?.();
}

function enqueueSharedStateUpdate(state: OfflineState, operation: () => Promise<void>): Promise<void> {
  const previous = state.sharedStateQueue.catch(() => undefined);
  const next = previous.then(operation);
  state.sharedStateQueue = next.catch(() => undefined);
  return next;
}

function buildSharedTargetDescriptor(
  target: OfflineQueryTarget,
  source: SnapshotTarget
): OfflineSharedTargetDescriptor {
  const sourceLike = source as any;
  return {
    targetId: target.targetId,
    userId: target.userId ?? 'anonymous',
    targetType: target.targetType,
    canonicalId: target.canonicalId ?? target.canonicalQuery,
    canonicalQuery: target.canonicalQuery,
    path: target.path ?? (Array.isArray(sourceLike._path) ? sourceLike._path.join('/') : undefined),
    filters: target.filters ?? sourceLike._conditions ?? [],
    orderBy: target.orderBy ?? sourceLike._explicitOrder ?? [],
    limit: target.limit ?? sourceLike._limit ?? null,
  };
}

function rebuildTargetFromSharedDescriptor(db: Oracledb, descriptor: OfflineSharedTargetDescriptor): SnapshotTarget {
  if (descriptor.targetType === 'document') {
    return new DocumentReference(db, descriptor.path);
  }
  const query = new Query(db);
  (query as any)._path = descriptor.path ? descriptor.path.split('/').filter(Boolean) : [];
  (query as any)._conditions = descriptor.filters ?? [];
  (query as any)._explicitOrder = descriptor.orderBy ?? [];
  (query as any)._limit = descriptor.limit ?? 0;
  return query;
}

function assertValidListenSource(options: ListenOptions): void {
  if (options.source == null || options.source === 'default' || options.source === 'cache') {
    return;
  }
  throw new Error(`Unsupported snapshot listen source ${String(options.source)}`);
}

function isCompleteCollectionTarget(target: Query<any, any> | CollectionReference<any, any> | DocumentReference<any, any>): boolean {
  if (target instanceof DocumentReference) return true;
  const queryLike = target as any;
  return (queryLike._conditions?.length ?? 0) === 0 &&
    (queryLike._limit ?? 0) === 0 &&
    (queryLike._joins?.length ?? 0) === 0 &&
    (queryLike._aggregate?.length ?? 0) === 0 &&
    !queryLike._vectorSearch;
}
