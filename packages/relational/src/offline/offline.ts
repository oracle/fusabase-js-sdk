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

import { getAuthCore } from '../../../auth-core/src/index.js';
import type { RelationalDb, RelationalResponse } from '../relational.js';
import type {
  RelationalCachedRow,
  RelationalOfflineMetadata,
  RelationalOfflineMutation,
  RelationalOfflineOptions,
  RelationalOfflineRequest,
  RelationalOfflineSnapshot,
  RelationalPersistentCacheOptions,
  RelationalRowOverlay,
} from './types.js';

type RuntimeResponse = RelationalResponse<any> & { offline?: RelationalOfflineMetadata };
type RemoteExecutor = (request: RelationalOfflineRequest) => Promise<RuntimeResponse>;
type ForwardedReadRequest = Omit<RelationalOfflineRequest, 'app' | 'signal'>;
type ReadRequestHandler = (request: ForwardedReadRequest) => Promise<RuntimeResponse | undefined>;

type State = {
  options: Required<Omit<RelationalOfflineOptions, 'relations'>> & Pick<RelationalOfflineOptions, 'relations'>;
  networkEnabled: boolean;
  stores: Map<string, UserStore>;
  requests: Map<string, RelationalOfflineRequest>;
  subscribedDatabases: Set<string>;
  drains: Map<string, Promise<void>>;
  recoveries: Map<string, Promise<void>>;
  recoveredMutations: Map<string, Map<string, RuntimeResponse>>;
  remote?: RemoteExecutor;
  waiters: Set<() => void>;
  tab: TabLease;
  activeDatabase?: string;
};

const OFFLINE = new WeakMap<object, State>();
const MEMORY = new Map<string, RelationalOfflineSnapshot>();
let defaultRemoteExecutor: RemoteExecutor | undefined;

/** @internal Registers the relational REST executor without coupling this module to another service package. */
export function setOfflineRemoteExecutor(executor: RemoteExecutor): void {
  defaultRemoteExecutor = executor;
}

function offlineError(message: string, code: string, status = 400): Error & { code: string; status: number } {
  const error = new Error(message) as Error & { code: string; status: number };
  error.code = code;
  error.status = status;
  return error;
}

function identityFor(request: RelationalOfflineRequest): string {
  try {
    const user: any = getAuthCore(request.app!).currentUser;
    return String(user?.uid ?? user?.user_id ?? user?.sub ?? user?.email ?? 'anonymous');
  } catch {
    return 'anonymous';
  }
}

function databaseName(request: RelationalOfflineRequest, user: string): string {
  const app = request.app!;
  const namespace = JSON.stringify({
    v: 1,
    endpoint: app.options.ordsHost ?? '',
    project: app.options.projectID ?? '',
    app: app.options.appID ?? '',
    schema: request.schema ?? app.options.schema ?? '',
    user,
  });
  return `FUSABASE_RELATIONAL_OFFLINE_V1:${encodeURIComponent(namespace)}`;
}

function emptySnapshot(): RelationalOfflineSnapshot {
  return { nextBatchId: 1, nextSequenceNumber: 1, rows: [], mutations: [], overlays: [], mutationRows: [], targets: [] };
}

function cloneSnapshot(snapshot: RelationalOfflineSnapshot): RelationalOfflineSnapshot {
  const cloned = structuredClone(snapshot) as RelationalOfflineSnapshot;
  cloned.overlays ??= [];
  cloned.mutationRows ??= [];
  cloned.rows ??= [];
  cloned.mutations ??= [];
  cloned.targets ??= [];
  return cloned;
}

class UserStore {
  private loaded = false;
  private snapshot = emptySnapshot();
  private writeQueue: Promise<void> = Promise.resolve();
  private rowsByRelation = new Map<string, RelationalCachedRow[]>();
  private overlaysByRelation = new Map<string, RelationalRowOverlay[]>();
  private mutationsByBatch = new Map<number, RelationalOfflineMutation>();
  private targetsByCanonical = new Map<string, RelationalOfflineSnapshot['targets'][number]>();

  constructor(private readonly name: string, private readonly persistent: boolean) {}

  async ready(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.persistent) {
      this.snapshot = cloneSnapshot(MEMORY.get(this.name) ?? emptySnapshot());
      this.reindex();
      return;
    }
    if (typeof indexedDB === 'undefined') {
      throw offlineError('IndexedDB persistence is not available in this environment', 'unimplemented');
    }
    this.snapshot = await this.readIndexedDb();
    this.reindex();
  }

  /** Refreshes a shared IndexedDB view after another tab changes it. */
  async refresh(): Promise<void> {
    await this.ready();
    if (this.persistent) {
      this.snapshot = await this.readIndexedDb();
      this.reindex();
    }
  }

  async clear(): Promise<void> {
    await this.ready();
    this.snapshot = emptySnapshot();
    this.reindex();
    await this.persist();
  }

  rows(relation: string): RelationalCachedRow[] {
    return this.rowsByRelation.get(relation) ?? [];
  }

  upsertRows(relation: string, primaryKey: string[], data: unknown[]): void {
    for (const item of data) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      const key = primaryKey.map(column => record[column]) as IDBValidKey[];
      if (key.some(value => !isValidKey(value))) continue;
      const index = this.snapshot.rows.findIndex(row => row.relation === relation && keysEqual(row.key, key));
      const row: RelationalCachedRow = {
        relation,
        key,
        data: structuredClone(record),
        sequenceNumber: this.snapshot.nextSequenceNumber++,
      };
      if (index >= 0) this.snapshot.rows[index] = row;
      else this.snapshot.rows.push(row);
    }
    this.reindex();
  }

  collectGarbage(maxBytes: number): void {
    if (!Number.isFinite(maxBytes)) return;
    const encodedSize = (value: unknown) => new Blob([JSON.stringify(value)]).size;
    let total = this.snapshot.rows.reduce((size, row) => size + encodedSize(row), 0);
    if (total <= maxBytes) return;
    const protectedRows = new Set(this.snapshot.overlays.map(overlay => `${overlay.relation}:${stable(overlay.key)}`));
    const candidates = [...this.snapshot.rows]
      .filter(row => !protectedRows.has(`${row.relation}:${stable(row.key)}`))
      .sort((left, right) => left.sequenceNumber - right.sequenceNumber);
    const evicted = new Set<string>();
    for (const row of candidates) {
      if (total <= maxBytes) break;
      const key = `${row.relation}:${stable(row.key)}`;
      total -= encodedSize(row);
      evicted.add(key);
    }
    if (evicted.size === 0) return;
    this.snapshot.rows = this.snapshot.rows.filter(row => !evicted.has(`${row.relation}:${stable(row.key)}`));
    // A target that lost a member can no longer certify a complete cache read.
    this.snapshot.targets = this.snapshot.targets.filter(target => !target.keys.some(key =>
      evicted.has(`${target.relation}:${stable(key.slice(1))}`)
    ));
    this.reindex();
  }

  addTarget(canonical: string, relation: string, keys: IDBValidKey[][]): void {
    const existing = this.snapshot.targets.find(target => target.canonical === canonical);
    const flattened = keys.map(key => [relation, ...key] as IDBValidKey[]);
    if (existing) {
      existing.keys = flattened;
    } else {
      this.snapshot.targets.push({ canonical, relation, keys: flattened });
    }
    this.reindex();
  }

  isCompleteTarget(canonical: string): boolean {
    return this.targetsByCanonical.has(canonical);
  }

  enqueue(request: RelationalOfflineRequest): RelationalOfflineMutation {
    const persisted = { ...request };
    delete persisted.app;
    delete persisted.signal;
    const mutation: RelationalOfflineMutation = {
      batchId: this.snapshot.nextBatchId++,
      mutationId: request.mutationId ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      request: persisted,
      createdAt: Date.now(),
      state: 'pending',
    };
    this.snapshot.mutations.push(mutation);
    this.reindex();
    return mutation;
  }

  pending(): RelationalOfflineMutation[] {
    return [...this.mutationsByBatch.values()]
      .filter(mutation => mutation.state === 'pending')
      .sort((left, right) => left.batchId - right.batchId);
  }

  overlays(relation: string): RelationalRowOverlay[] {
    return (this.overlaysByRelation.get(relation) ?? [])
      .filter(overlay => this.mutationsByBatch.get(overlay.batchId)?.state === 'pending')
      .sort((left, right) => left.batchId - right.batchId);
  }

  setOverlays(batchId: number, overlays: RelationalRowOverlay[]): void {
    this.snapshot.overlays = this.snapshot.overlays.filter(overlay => overlay.batchId !== batchId);
    this.snapshot.mutationRows = this.snapshot.mutationRows.filter(entry => entry.batchId !== batchId);
    this.snapshot.overlays.push(...overlays);
    this.snapshot.mutationRows.push(...overlays.map(overlay => ({
      batchId: overlay.batchId,
      relation: overlay.relation,
      key: overlay.key,
    })));
    this.reindex();
  }

  commitBatch(batchId: number): void {
    const overlays = this.snapshot.overlays.filter(overlay => overlay.batchId === batchId);
    for (const overlay of overlays) {
      const index = this.snapshot.rows.findIndex(row => row.relation === overlay.relation && keysEqual(row.key, overlay.key));
      if (overlay.kind === 'delete') {
        if (index >= 0) this.snapshot.rows.splice(index, 1);
        continue;
      }
      if (!overlay.data) continue;
      const row: RelationalCachedRow = {
        relation: overlay.relation,
        key: [...overlay.key],
        data: structuredClone(overlay.data),
        sequenceNumber: this.snapshot.nextSequenceNumber++,
      };
      if (index >= 0) this.snapshot.rows[index] = row;
      else this.snapshot.rows.push(row);
    }
    this.acknowledge(batchId);
  }

  acknowledge(batchId: number): void {
    const index = this.snapshot.mutations.findIndex(mutation => mutation.batchId === batchId);
    if (index >= 0) this.snapshot.mutations.splice(index, 1);
    this.snapshot.overlays = this.snapshot.overlays.filter(overlay => overlay.batchId !== batchId);
    this.snapshot.mutationRows = this.snapshot.mutationRows.filter(entry => entry.batchId !== batchId);
    this.reindex();
  }

  reject(batchId: number, error: unknown): void {
    const mutation = this.snapshot.mutations.find(item => item.batchId === batchId);
    if (!mutation) return;
    mutation.state = 'rejected';
    mutation.error = {
      message: error instanceof Error ? error.message : String(error),
      status: Number((error as any)?.status ?? 0),
      code: typeof (error as any)?.code === 'string' ? (error as any).code : undefined,
    };
    this.snapshot.overlays = this.snapshot.overlays.filter(overlay => overlay.batchId !== batchId);
    this.snapshot.mutationRows = this.snapshot.mutationRows.filter(entry => entry.batchId !== batchId);
    this.reindex();
  }

  async save(): Promise<void> {
    await this.persist();
  }

  async close(): Promise<void> {
    await this.persist();
  }

  private reindex(): void {
    this.rowsByRelation.clear();
    this.overlaysByRelation.clear();
    this.mutationsByBatch.clear();
    this.targetsByCanonical.clear();
    for (const row of this.snapshot.rows) {
      const values = this.rowsByRelation.get(row.relation) ?? [];
      values.push(row);
      this.rowsByRelation.set(row.relation, values);
    }
    for (const overlay of this.snapshot.overlays) {
      const values = this.overlaysByRelation.get(overlay.relation) ?? [];
      values.push(overlay);
      this.overlaysByRelation.set(overlay.relation, values);
    }
    for (const mutation of this.snapshot.mutations) this.mutationsByBatch.set(mutation.batchId, mutation);
    for (const target of this.snapshot.targets) this.targetsByCanonical.set(target.canonical, target);
  }

  private async persist(): Promise<void> {
    const task = async () => {
      const value = cloneSnapshot(this.snapshot);
      if (!this.persistent) {
        MEMORY.set(this.name, value);
        return;
      }
      const db = await this.open();
      await new Promise<void>((resolve, reject) => {
        const stores = [
          'remote_rows', 'row_overlays', 'mutations', 'mutation_rows',
          'query_targets', 'target_rows', 'mutation_results', 'globals',
        ];
        const transaction = db.transaction(stores, 'readwrite');
        for (const storeName of stores) transaction.objectStore(storeName).clear();
        const rows = transaction.objectStore('remote_rows');
        for (const row of value.rows) rows.put(row, [row.relation, ...row.key]);
        const overlays = transaction.objectStore('row_overlays');
        for (const overlay of value.overlays) overlays.put(overlay, [overlay.relation, ...overlay.key, overlay.batchId]);
        const mutationRows = transaction.objectStore('mutation_rows');
        for (const entry of value.mutationRows) mutationRows.put(entry, [entry.relation, ...entry.key, entry.batchId]);
        const mutations = transaction.objectStore('mutations');
        const results = transaction.objectStore('mutation_results');
        for (const mutation of value.mutations) {
          mutations.put(mutation, mutation.batchId);
          if (mutation.state !== 'pending') results.put(mutation, mutation.batchId);
        }
        const targets = transaction.objectStore('query_targets');
        const targetRows = transaction.objectStore('target_rows');
        for (const target of value.targets) {
          targets.put(target, target.canonical);
          for (const key of target.keys) targetRows.put({ canonical: target.canonical, key }, [target.canonical, ...key]);
        }
        transaction.objectStore('globals').put({
          schemaVersion: 3,
          nextBatchId: value.nextBatchId,
          nextSequenceNumber: value.nextSequenceNumber,
        }, 'globals');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      db.close();
    };
    const previous = this.writeQueue.catch(() => undefined);
    this.writeQueue = previous.then(task);
    return this.writeQueue;
  }

  private async readIndexedDb(): Promise<RelationalOfflineSnapshot> {
    const db = await this.open();
    try {
      return await new Promise<RelationalOfflineSnapshot>((resolve, reject) => {
        const transaction = db.transaction(['remote_rows', 'row_overlays', 'mutation_rows', 'mutations', 'query_targets', 'globals'], 'readonly');
        const rows = transaction.objectStore('remote_rows').getAll();
        const overlays = transaction.objectStore('row_overlays').getAll();
        const mutationRows = transaction.objectStore('mutation_rows').getAll();
        const mutations = transaction.objectStore('mutations').getAll();
        const targets = transaction.objectStore('query_targets').getAll();
        const globals = transaction.objectStore('globals').get('globals');
        transaction.oncomplete = () => resolve({
          nextBatchId: Number(globals.result?.nextBatchId) || 1,
          nextSequenceNumber: Number(globals.result?.nextSequenceNumber) || 1,
          rows: (rows.result ?? []) as RelationalCachedRow[],
          overlays: (overlays.result ?? []) as RelationalRowOverlay[],
          mutationRows: (mutationRows.result ?? []) as RelationalOfflineSnapshot['mutationRows'],
          mutations: (mutations.result ?? []) as RelationalOfflineMutation[],
          targets: (targets.result ?? []) as RelationalOfflineSnapshot['targets'],
        });
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      db.close();
    }
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, 3);
      request.onupgradeneeded = () => {
        const db = request.result;
        const transaction = request.transaction!;
        const legacyState = db.objectStoreNames.contains('state')
          ? transaction.objectStore('state').get('snapshot')
          : null;
        const names = [
          'remote_rows', 'row_overlays', 'mutations', 'mutation_rows',
          'query_targets', 'target_rows', 'mutation_results', 'globals',
        ];
        for (const name of names) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
        const ensureIndex = (storeName: string, indexName: string, keyPath: string | string[]) => {
          const store = transaction.objectStore(storeName);
          if (!store.indexNames.contains(indexName)) store.createIndex(indexName, keyPath);
        };
        ensureIndex('remote_rows', 'by_relation', 'relation');
        ensureIndex('remote_rows', 'by_sequence', 'sequenceNumber');
        ensureIndex('row_overlays', 'by_relation', 'relation');
        ensureIndex('row_overlays', 'by_batch', 'batchId');
        ensureIndex('mutation_rows', 'by_relation', 'relation');
        ensureIndex('mutation_rows', 'by_batch', 'batchId');
        ensureIndex('mutations', 'by_state', 'state');
        ensureIndex('query_targets', 'by_relation', 'relation');
        if (legacyState) {
          legacyState.onsuccess = () => {
            if (!legacyState.result) return;
            const snapshot = cloneSnapshot(legacyState.result as RelationalOfflineSnapshot);
            const rows = transaction.objectStore('remote_rows');
            for (const row of snapshot.rows) rows.put(row, [row.relation, ...row.key]);
            const mutations = transaction.objectStore('mutations');
            for (const mutation of snapshot.mutations) mutations.put(mutation, mutation.batchId);
            const targets = transaction.objectStore('query_targets');
            const targetRows = transaction.objectStore('target_rows');
            for (const target of snapshot.targets) {
              targets.put(target, target.canonical);
              for (const key of target.keys) targetRows.put({ canonical: target.canonical, key }, [target.canonical, ...key]);
            }
            transaction.objectStore('globals').put({
              schemaVersion: 3,
              nextBatchId: snapshot.nextBatchId,
              nextSequenceNumber: snapshot.nextSequenceNumber,
            }, 'globals');
          };
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open relational offline persistence'));
    });
  }
}

class TabLease {
  private readonly tabId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  private readonly channels = new Map<string, BroadcastChannel>();
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly readHandlers = new Map<string, Set<ReadRequestHandler>>();
  private readonly readWaiters = new Map<string, { resolve: (response: RuntimeResponse) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }>();
  private readonly storageHandlers = new Map<string, (event: StorageEvent) => void>();
  private readonly heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly leaseMs = 5000;
  private readonly heartbeatMs = 2000;
  private readonly onPageHide = () => {
    for (const database of [...this.heartbeatTimers.keys()]) this.release(database);
  };

  constructor(private readonly synchronize: boolean) {
    if (synchronize && typeof window !== 'undefined') window.addEventListener('pagehide', this.onPageHide);
  }

  canReplay(database: string): boolean {
    if (!this.synchronize || typeof localStorage === 'undefined') return true;
    const primary = this.tryAcquire(database);
    if (primary) this.startHeartbeat(database);
    else this.stopHeartbeat(database);
    return primary;
  }

  /** Whether another live tab currently owns the network lease. */
  hasPrimary(database: string): boolean {
    if (!this.synchronize || typeof localStorage === 'undefined') return false;
    try {
      const current = JSON.parse(localStorage.getItem(`${database}:primary-tab`) ?? 'null');
      return Boolean(current?.tabId && current.expiresAt > Date.now());
    } catch {
      return false;
    }
  }

  release(database: string): void {
    this.stopHeartbeat(database);
    if (!this.synchronize || typeof localStorage === 'undefined') return;
    const key = `${database}:primary-tab`;
    try {
      const current = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (current?.tabId === this.tabId) localStorage.removeItem(key);
    } catch {
      // Best effort; the short lease still lets a successor take ownership.
    }
  }

  private tryAcquire(database: string): boolean {
    const key = `${database}:primary-tab`;
    const now = Date.now();
    try {
      const current = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (!current || current.expiresAt <= now || current.tabId === this.tabId) {
        localStorage.setItem(key, JSON.stringify({ tabId: this.tabId, expiresAt: now + this.leaseMs }));
        return true;
      }
      return false;
    } catch {
      // Storage can be disabled; in that case each tab retains independent
      // operation rather than permanently blocking offline replay.
      return true;
    }
  }

  private startHeartbeat(database: string): void {
    if (this.heartbeatTimers.has(database)) return;
    const timer = setInterval(() => {
      if (!this.tryAcquire(database)) this.stopHeartbeat(database);
    }, this.heartbeatMs);
    this.heartbeatTimers.set(database, timer);
  }

  private stopHeartbeat(database: string): void {
    const timer = this.heartbeatTimers.get(database);
    if (timer) clearInterval(timer);
    this.heartbeatTimers.delete(database);
  }

  onChange(database: string, listener: () => void): void {
    if (!this.synchronize) return;
    const listeners = this.listeners.get(database) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(database, listeners);
    if (typeof BroadcastChannel !== 'undefined' && !this.channels.has(database)) {
      const channel = new BroadcastChannel(`${database}:changes`);
      channel.onmessage = (event) => this.handleMessage(database, channel, event.data);
      this.channels.set(database, channel);
    }
    if (typeof window !== 'undefined' && !this.storageHandlers.has(database)) {
      const handler = (event: StorageEvent) => {
        if (event.storageArea !== window.localStorage || event.key !== `${database}:cache-change`) return;
        for (const callback of this.listeners.get(database) ?? []) callback();
      };
      window.addEventListener('storage', handler);
      this.storageHandlers.set(database, handler);
    }
  }

  notify(database: string): void {
    if (!this.synchronize) return;
    this.channels.get(database)?.postMessage({ kind: 'cache-change', tabId: this.tabId, changedAt: Date.now() });
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`${database}:cache-change`, JSON.stringify({ tabId: this.tabId, changedAt: Date.now() }));
      } catch {
        // BroadcastChannel remains the preferred notification mechanism.
      }
    }
  }

  onReadRequest(database: string, handler: ReadRequestHandler): void {
    if (!this.synchronize) return;
    const handlers = this.readHandlers.get(database) ?? new Set<ReadRequestHandler>();
    handlers.add(handler);
    this.readHandlers.set(database, handlers);
  }

  forwardRead(database: string, request: ForwardedReadRequest): Promise<RuntimeResponse> {
    const channel = this.channels.get(database);
    if (!this.synchronize || !channel) {
      return Promise.reject(new Error('No synchronized primary tab is available for this read'));
    }
    const requestId = `${this.tabId}:${Date.now()}:${Math.random()}`;
    return new Promise<RuntimeResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.readWaiters.delete(requestId);
        reject(new Error('The primary tab did not respond to the read request'));
      }, 10_000);
      this.readWaiters.set(requestId, { resolve, reject, timeout });
      try {
        channel.postMessage({ kind: 'read-request', tabId: this.tabId, requestId, request });
      } catch (error) {
        clearTimeout(timeout);
        this.readWaiters.delete(requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private handleMessage(database: string, channel: BroadcastChannel, message: any): void {
    if (message?.kind === 'read-response' && message.targetTabId === this.tabId) {
      const waiter = this.readWaiters.get(message.requestId);
      if (!waiter) return;
      clearTimeout(waiter.timeout);
      this.readWaiters.delete(message.requestId);
      waiter.resolve(message.response as RuntimeResponse);
      return;
    }
    if (message?.kind === 'read-request') {
      if (message.tabId === this.tabId) return;
      for (const handler of this.readHandlers.get(database) ?? []) {
        void handler(message.request as ForwardedReadRequest).then((response) => {
          if (response !== undefined) {
            channel.postMessage({ kind: 'read-response', requestId: message.requestId, targetTabId: message.tabId, response });
          }
        }).catch(() => undefined);
      }
      return;
    }
    for (const callback of this.listeners.get(database) ?? []) callback();
  }

  shutdown(): void {
    for (const database of [...this.heartbeatTimers.keys()]) this.release(database);
    for (const channel of this.channels.values()) channel.close();
    this.channels.clear();
    if (typeof window !== 'undefined') {
      for (const handler of this.storageHandlers.values()) window.removeEventListener('storage', handler);
    }
    this.storageHandlers.clear();
    this.listeners.clear();
    this.readHandlers.clear();
    for (const waiter of this.readWaiters.values()) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Offline synchronization was shut down'));
    }
    this.readWaiters.clear();
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.onPageHide);
  }
}

function isValidKey(value: unknown): value is IDBValidKey {
  return typeof value === 'string' || typeof value === 'number' || value instanceof Date || value instanceof ArrayBuffer;
}

function keysEqual(left: IDBValidKey[], right: IDBValidKey[]): boolean {
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
}

function stable(value: unknown): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${stable((value as any)[key])}`).join(',')}}`;
}

function canonicalRequest(request: RelationalOfflineRequest): string {
  return stable({ relation: request.object, projection: request.projection, qbe: request.qbe, single: request.maybeSingle });
}

function valueAt(data: Record<string, unknown>, column: string, path?: string): unknown {
  const segments = [
    ...column.split(/->>?|\./).filter(Boolean),
    ...(path ?? '').split('.').filter(Boolean),
  ];
  let value: any = data[segments.shift() ?? ''];
  for (const segment of segments) {
    if (value == null || typeof value !== 'object') return undefined;
    value = value[segment];
  }
  return value;
}

function compare(left: unknown, right: unknown): number {
  if (left === right) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime();
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right));
}

function like(value: unknown, pattern: unknown, insensitive = false): boolean {
  if (typeof value !== 'string' || typeof pattern !== 'string') return false;
  let expression = '^';
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index];
    if (char === '\\' && index + 1 < pattern.length) expression += escapeRegex(pattern[++index]);
    else if (char === '%') expression += '.*';
    else if (char === '_') expression += '.';
    else expression += escapeRegex(char);
  }
  expression += '$';
  return new RegExp(expression, insensitive ? 'i' : '').test(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesOperator(value: unknown, operator: string, operand: unknown): boolean {
  switch (operator) {
    case '$eq': return compare(value, operand) === 0;
    case '$ne': return compare(value, operand) !== 0;
    case '$gt': return compare(value, operand) > 0;
    case '$gte': return compare(value, operand) >= 0;
    case '$lt': return compare(value, operand) < 0;
    case '$lte': return compare(value, operand) <= 0;
    case '$in': return Array.isArray(operand) && operand.some(item => compare(value, item) === 0);
    case '$nin': return Array.isArray(operand) && operand.every(item => compare(value, item) !== 0);
    case '$between': return Array.isArray(operand) && operand.length === 2 && compare(value, operand[0]) >= 0 && compare(value, operand[1]) <= 0;
    case '$exists': return operand ? value != null : value == null;
    case '$like': return like(value, operand);
    case '$ilike': return like(value, operand, true);
    case '$instr': return typeof value === 'string' && typeof operand === 'string' && value.includes(operand);
    case '$ninstr': return !(typeof value === 'string' && typeof operand === 'string' && value.includes(operand));
    case '$startsWith': return typeof value === 'string' && typeof operand === 'string' && value.startsWith(operand);
    case '$hasSubstring': return typeof value === 'string' && typeof operand === 'string' && value.includes(operand);
    case '$all': return Array.isArray(value) && Array.isArray(operand) && operand.every(item => value.some(entry => compare(entry, item) === 0));
    case '$overlaps': return Array.isArray(value) && Array.isArray(operand) && operand.some(item => value.some(entry => compare(entry, item) === 0));
    case '$bitsAllSet': return Number.isSafeInteger(value) && Number.isSafeInteger(operand) && ((value as number) & (operand as number)) === operand;
    case '$bitsAllClear': return Number.isSafeInteger(value) && Number.isSafeInteger(operand) && ((value as number) & (operand as number)) === 0;
    case '$bitsAnySet': return Number.isSafeInteger(value) && Number.isSafeInteger(operand) && ((value as number) & (operand as number)) !== 0;
    case '$bitsAnyClear': return Number.isSafeInteger(value) && Number.isSafeInteger(operand) && ((~(value as number) & (operand as number)) !== 0);
    case '$regex':
    case '$likeRegex':
    case '$ciRegex':
    case '$ciLikeRegex': {
      if (typeof value !== 'string' || typeof operand !== 'string') return false;
      return new RegExp(operand, operator.includes('ci') ? 'i' : '').test(value);
    }
    case '$nlRegex':
    case '$nlLikeRegex':
    case '$nlciRegex':
    case '$nlciLikeRegex': {
      if (typeof value !== 'string' || typeof operand !== 'string') return true;
      return !new RegExp(operand, operator.includes('ci') ? 'i' : '').test(value);
    }
    case '$not': return !matchesPredicateValue(value, operand);
    default: throw offlineError(`Offline cache queries do not support ${operator}`, 'offline-query-unsupported');
  }
}

function matchesPredicateValue(value: unknown, predicate: unknown): boolean {
  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate)) return compare(value, predicate) === 0;
  return Object.entries(predicate as Record<string, unknown>).every(([operator, operand]) => {
    if (!operator.startsWith('$')) return matchesPredicateValue(value && typeof value === 'object' ? (value as any)[operator] : undefined, operand);
    return matchesOperator(value, operator, operand);
  });
}

function matchesRow(row: Record<string, unknown>, predicate?: Record<string, unknown>): boolean {
  if (!predicate || Object.keys(predicate).length === 0) return true;
  return Object.entries(predicate).every(([field, condition]) => {
    if (field === '$and') return Array.isArray(condition) && condition.every(item => matchesRow(row, item as Record<string, unknown>));
    if (field === '$or') return Array.isArray(condition) && condition.some(item => matchesRow(row, item as Record<string, unknown>));
    if (field === '$not') return !matchesRow(row, condition as Record<string, unknown>);
    const pieces = field.split(/->>?|\./).filter(Boolean);
    let value: any = row[pieces.shift()!];
    for (const piece of pieces) value = value && typeof value === 'object' ? value[piece] : undefined;
    return matchesPredicateValue(value, condition);
  });
}

function project(rows: Record<string, unknown>[], request: RelationalOfflineRequest): unknown {
  if (request.projection.relations.length > 0) throw offlineError('Offline cache queries do not support relation projections yet', 'offline-query-unsupported');
  let result: any[] = rows.map(row => {
    if (request.projection.all) return structuredClone(row);
    const selected: Record<string, unknown> = {};
    for (const column of request.projection.columns) {
      const source = typeof column === 'string' ? column : column.column;
      const target = typeof column === 'string' ? column : column.alias;
      selected[target] = valueAt(row, source.replace(/->/g, '.'), '');
    }
    return selected;
  });
  if (request.projection.aggregates.length > 0) {
    const aggregate: Record<string, unknown> = {};
    for (const spec of request.projection.aggregates) {
      const values = spec.column ? rows.map(row => valueAt(row, spec.column!.replace(/->/g, '.'), '')).filter(value => value != null) : [];
      const key = spec.alias ?? `${spec.column ? `${spec.column}.` : ''}${spec.function}`;
      if (spec.function === 'count') aggregate[key] = spec.column ? values.length : rows.length;
      else if (spec.function === 'sum') aggregate[key] = values.reduce<number>((sum, value) => sum + Number(value), 0);
      else if (spec.function === 'avg') aggregate[key] = values.length ? values.reduce<number>((sum, value) => sum + Number(value), 0) / values.length : null;
      else if (spec.function === 'min') aggregate[key] = values.sort(compare)[0] ?? null;
      else aggregate[key] = values.sort(compare)[values.length - 1] ?? null;
    }
    result = [aggregate];
  }
  return request.maybeSingle ? (result.length === 1 ? result[0] : null) : result;
}

function applyOverlays(rows: RelationalCachedRow[], overlays: RelationalRowOverlay[]): Record<string, unknown>[] {
  const values = rows.map(row => structuredClone(row.data));
  const byKey = new Map(rows.map((row, index) => [stable(row.key), values[index]]));
  for (const overlay of overlays) {
    const key = stable(overlay.key);
    if (overlay.kind === 'delete') byKey.delete(key);
    else if (overlay.data) byKey.set(key, structuredClone(overlay.data));
  }
  return [...byKey.values()];
}

function buildOverlays(
  request: RelationalOfflineRequest,
  batchId: number,
  primaryKey: string[],
  currentRows: Record<string, unknown>[]
): RelationalRowOverlay[] {
  const result: RelationalRowOverlay[] = [];
  const add = (data: Record<string, unknown> | null, kind: 'set' | 'delete') => {
    const key = primaryKey.map(column => data?.[column]) as IDBValidKey[];
    if (key.some(value => !isValidKey(value))) return;
    result.push({ batchId, relation: request.object, key, kind, data: kind === 'delete' || data == null ? null : structuredClone(data) });
  };
  if (request.operation === 'insert' || request.operation === 'upsert') {
    for (const row of request.rows ?? []) {
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        const current = row as Record<string, unknown>;
        const key = primaryKey.map(column => current[column]);
        const existing = currentRows.find(candidate => stable(primaryKey.map(column => candidate[column])) === stable(key));
        add(request.operation === 'upsert' && existing ? { ...existing, ...current } : current, 'set');
      }
    }
  } else if (request.operation === 'update') {
    for (const row of currentRows) if (matchesRow(row, request.qbe.$query)) add({ ...row, ...(request.set as Record<string, unknown>) }, 'set');
  } else if (request.operation === 'delete') {
    for (const row of currentRows) if (matchesRow(row, request.qbe.$query)) add(row, 'delete');
  }
  return result;
}

async function stateFor(request: RelationalOfflineRequest): Promise<{ state: State; store: UserStore; database: string }> {
  const state = OFFLINE.get(request.app!);
  if (!state) throw offlineError('Offline support is not enabled for this relational client', 'failed-precondition');
  const identity = identityFor(request);
  const database = databaseName(request, identity);
  if (state.activeDatabase && state.activeDatabase !== database) {
    state.tab.release(state.activeDatabase);
    state.requests.delete(state.activeDatabase);
    for (const resolve of state.waiters) resolve();
    state.waiters.clear();
  }
  state.activeDatabase = database;
  let store = state.stores.get(database);
  if (!store) {
    store = new UserStore(database, state.options.persistence === 'indexeddb');
    state.stores.set(database, store);
  }
  await store.ready();
  if (!state.subscribedDatabases.has(database)) {
    state.subscribedDatabases.add(database);
    state.tab.onChange(database, () => {
      void (async () => {
        await store.refresh();
        // A mutation may have been persisted by a tab whose network is disabled.
        // The tab holding the replay lease owns the network work, so it must drain
        // after refreshing rather than merely observing the cache change.
        const latestRequest = state.requests.get(database);
        if (state.networkEnabled && state.remote && latestRequest) {
          await drain(latestRequest, state, store, database, state.remote);
        }
        if (store.pending().length === 0) {
          for (const resolve of state.waiters) resolve();
          state.waiters.clear();
        }
      })().catch(() => undefined);
    });
    state.tab.onReadRequest(database, async (forwarded) => {
      // All tabs receive the request, but only the network-enabled lease holder
      // is allowed to perform the HTTP read and answer the requesting tab.
      if (!state.networkEnabled || !state.remote || !state.tab.canReplay(database)) return undefined;
      await store.refresh();
      const proxied = { ...forwarded, app: request.app! } as RelationalOfflineRequest;
      if (state.recoveries.has(database)) return executeCached(proxied, store);
      await drain(proxied, state, store, database, state.remote);
      try {
        return await executeRemoteAndCache(proxied, state, store, database, state.remote);
      } catch (error) {
        if (!isNetworkFailure(error)) throw error;
        return (await recoverNetwork(proxied, state, store, database, state.remote)) ?? executeCached(proxied, store);
      }
    });
  }
  if (state.options.synchronizeTabs) await store.refresh();
  state.requests.set(database, request);
  return { state, store, database };
}

function response(data: unknown, metadata: RelationalOfflineMetadata, status = 200): RuntimeResponse {
  return { data, error: null, count: null, status, statusText: status === 200 ? 'OK' : 'Accepted', offline: metadata };
}

async function executeCached(request: RelationalOfflineRequest, store: UserStore): Promise<RuntimeResponse> {
  if (request.operation !== 'select') throw offlineError('Cache-only execution is supported only for select()', 'offline-query-unsupported');
  const relation = request.object;
  const rows = store.rows(relation);
  const primaryKey = relationOptions(request, relation).primaryKey;
  const local = applyOverlays(rows, store.overlays(request.object))
    .filter(row => matchesRow(row, request.qbe.$query));
  const ordered = [...local].sort((left, right) => {
    for (const item of request.qbe.$orderby ?? []) {
      const leftValue = valueAt(left, item.column, item.path);
      const rightValue = valueAt(right, item.column, item.path);
      if (leftValue == null || rightValue == null) {
        if (leftValue === rightValue) continue;
        const nullsFirst = item.nulls === 'FIRST';
        const nullComparison = leftValue == null ? (nullsFirst ? -1 : 1) : (nullsFirst ? 1 : -1);
        return item.direction === 'DESC' ? -nullComparison : nullComparison;
      }
      const compared = compare(leftValue, rightValue);
      if (compared !== 0) return item.direction === 'DESC' ? -compared : compared;
    }
    return 0;
  });
  const offset = request.qbe.$offset ?? 0;
  const limited = request.qbe.$limit == null ? ordered.slice(offset) : ordered.slice(offset, offset + request.qbe.$limit);
  const complete = store.isCompleteTarget(canonicalRequest(request));
  if (request.requireComplete && !complete) {
    throw offlineError('The requested query is not completely available in the local cache', 'offline-cache-incomplete');
  }
  return response(project(limited, request), {
    fromCache: true,
    hasPendingWrites: store.pending().length > 0,
  });
}

function relationOptions(request: RelationalOfflineRequest, relation: string) {
  const state = OFFLINE.get(request.app!);
  const options = state?.options.relations[relation];
  if (!options || options.primaryKey.length === 0) {
    throw offlineError(`Offline support for relation '${relation}' requires a configured primaryKey`, 'offline-primary-key-required');
  }
  return options;
}

function hasRelationOptions(request: RelationalOfflineRequest, relation: string): boolean {
  return Boolean(OFFLINE.get(request.app!)?.options.relations[relation]?.primaryKey.length);
}

async function cacheRemoteResult(request: RelationalOfflineRequest, store: UserStore, result: RuntimeResponse, cacheSizeBytes: number): Promise<void> {
  if (request.operation !== 'select' || result.error || !Array.isArray(result.data)) return;
  if (!hasRelationOptions(request, request.object)) return;
  const primaryKey = relationOptions(request, request.object).primaryKey;
  store.upsertRows(request.object, primaryKey, result.data);
  const keys = result.data
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
    .map(item => primaryKey.map(column => (item as Record<string, unknown>)[column]) as IDBValidKey[])
    .filter(key => key.every(isValidKey));
  store.addTarget(canonicalRequest(request), request.object, keys);
  store.collectGarbage(cacheSizeBytes);
  await store.save();
}

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') return false;
  // Browser fetch rejects network/DNS/TLS/CORS failures as TypeError. Some
  // runtimes use NetworkError instead. HTTP/backend errors are responses and
  // therefore do not reach this path.
  return error instanceof TypeError || (error instanceof Error && error.name === 'NetworkError');
}

function retryDelay(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
}

function pause(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeRemoteAndCache(
  request: RelationalOfflineRequest,
  state: State,
  store: UserStore,
  database: string,
  remote: RemoteExecutor,
): Promise<RuntimeResponse> {
  const result = await executeRemoteOnce(request, remote);
  await cacheRemoteResult(request, store, result, state.options.cacheSizeBytes);
  state.tab.notify(database);
  return { ...result, offline: { fromCache: false, hasPendingWrites: store.pending().length > 0 } };
}

/** Offline recovery owns retry timing, so each attempt performs one HTTP request. */
function executeRemoteOnce(request: RelationalOfflineRequest, remote: RemoteExecutor): Promise<RuntimeResponse> {
  return remote({
    ...request,
    retry: { enabled: false, maxRetries: 0, initialDelayMs: 0, maxDelayMs: 0 },
  });
}

function recoverNetwork(
  request: RelationalOfflineRequest,
  state: State,
  store: UserStore,
  database: string,
  remote: RemoteExecutor,
): Promise<RuntimeResponse | undefined> {
  if (state.recoveries.has(database)) return Promise.resolve(undefined);
  let resolveForeground!: (value: RuntimeResponse | undefined) => void;
  let rejectForeground!: (reason: unknown) => void;
  const foreground = new Promise<RuntimeResponse | undefined>((resolve, reject) => {
    resolveForeground = resolve;
    rejectForeground = reject;
  });
  let recovery!: Promise<void>;
  recovery = (async () => {
    // The initial request has already failed once. If its first retry also
    // fails, release the caller to cache/queue mode but keep this loop alive.
    let failures = 1;
    let attempt = 0;
    for (;;) {
      await pause(retryDelay(attempt));
      try {
        const result = await executeRemoteAndCache(request, state, store, database, remote);
        if (request.mutationId) {
          const completed = state.recoveredMutations.get(database) ?? new Map<string, RuntimeResponse>();
          completed.set(request.mutationId, result);
          state.recoveredMutations.set(database, completed);
        }
        resolveForeground(result);
        return;
      } catch (error) {
        if (!isNetworkFailure(error)) {
          rejectForeground(error);
          return;
        }
        failures += 1;
        if (failures === 2) resolveForeground(undefined);
        attempt += 1;
      }
    }
  })().finally(() => {
    if (state.recoveries.get(database) === recovery) state.recoveries.delete(database);
  });
  state.recoveries.set(database, recovery);
  void recovery.then(async () => {
    // If recovery was started while a drain was in progress, wait for that
    // drain to release its lock before consuming the recovered mutation.
    const inFlightDrain = state.drains.get(database);
    if (inFlightDrain) await inFlightDrain.catch(() => undefined);
    const latestRequest = state.requests.get(database);
    if (latestRequest && state.remote) return drain(latestRequest, state, store, database, state.remote);
    return undefined;
  }).catch(() => undefined);
  return foreground;
}

async function queueWrite(request: RelationalOfflineRequest, store: UserStore): Promise<RuntimeResponse> {
  const mutation = store.enqueue(request);
  const primaryKey = relationOptions(request, request.object).primaryKey;
  const current = applyOverlays(store.rows(request.object), store.overlays(request.object));
  store.setOverlays(mutation.batchId, buildOverlays(request, mutation.batchId, primaryKey, current));
  await store.save();
  const data = request.returnRows
    ? project(applyOverlays(store.rows(request.object), store.overlays(request.object))
      .filter(row => matchesRow(row, request.qbe.$query)), request)
    : null;
  return response(data, { fromCache: true, hasPendingWrites: true }, 202);
}

async function drain(request: RelationalOfflineRequest, state: State, store: UserStore, database: string, remote: RemoteExecutor): Promise<void> {
  const inFlight = state.drains.get(database);
  if (inFlight) return inFlight;
  let work!: Promise<void>;
  work = drainPending(request, state, store, database, remote).finally(() => {
    if (state.drains.get(database) === work) state.drains.delete(database);
  });
  state.drains.set(database, work);
  return work;
}

/** Serializes replay because a change can arrive through BroadcastChannel and storage. */
async function drainPending(request: RelationalOfflineRequest, state: State, store: UserStore, database: string, remote: RemoteExecutor): Promise<void> {
  if (!state.networkEnabled || state.recoveries.has(database) || !state.tab.canReplay(database)) return;
  for (const mutation of store.pending()) {
      const recovered = state.recoveredMutations.get(database)?.get(mutation.mutationId);
      if (recovered) {
        state.recoveredMutations.get(database)?.delete(mutation.mutationId);
        store.commitBatch(mutation.batchId);
        if (Array.isArray(recovered.data)) {
          const primaryKey = relationOptions(request, mutation.request.object).primaryKey;
          store.upsertRows(mutation.request.object, primaryKey, recovered.data);
        }
        await store.save();
        state.tab.notify(database);
        continue;
      }
      const replay = { ...mutation.request, app: request.app, mutationId: mutation.mutationId };
    try {
      const result = await executeRemoteOnce(replay, remote);
      if (result.error) {
        store.reject(mutation.batchId, result.error);
        break;
      }
      store.commitBatch(mutation.batchId);
      if (Array.isArray(result.data)) {
        const primaryKey = relationOptions(request, replay.object).primaryKey;
        store.upsertRows(replay.object, primaryKey, result.data);
      }
      await store.save();
      state.tab.notify(database);
    } catch (error) {
      if (isNetworkFailure(error)) {
        try {
          const recovered = await recoverNetwork(replay, state, store, database, remote);
          // Recovery moved to the background after two network failures. Keep
          // this mutation pending; the successful background probe will drain it.
          if (!recovered) break;
          if (recovered.error) {
            store.reject(mutation.batchId, recovered.error);
            break;
          }
          state.recoveredMutations.get(database)?.delete(mutation.mutationId);
          store.commitBatch(mutation.batchId);
          if (Array.isArray(recovered.data)) {
            const primaryKey = relationOptions(request, replay.object).primaryKey;
            store.upsertRows(replay.object, primaryKey, recovered.data);
          }
          await store.save();
          state.tab.notify(database);
          continue;
        } catch (recoveryError) {
          store.reject(mutation.batchId, recoveryError);
          await store.save();
          state.tab.notify(database);
          break;
        }
      }
      store.reject(mutation.batchId, error);
      await store.save();
      state.tab.notify(database);
      break;
    }
  }
  if (store.pending().length === 0) {
    for (const resolve of state.waiters) resolve();
    state.waiters.clear();
  }
}

function forwardableReadRequest(request: RelationalOfflineRequest): ForwardedReadRequest {
  const { app: _app, signal: _signal, ...forwarded } = request;
  return forwarded;
}

/** @internal Routes a builder request through the relational-only offline layer. */
export async function executeOfflineRequest(request: RelationalOfflineRequest, remote: RemoteExecutor): Promise<RuntimeResponse> {
  if (request.operation !== 'select' && !request.mutationId) {
    request = { ...request, mutationId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}` };
  }
  const { state, store, database } = await stateFor(request);
  state.remote = remote;
  // Offline is opt-in per relation. A relation omitted from `relations` keeps
  // the normal relational behavior, including direct network access when the
  // configured offline relations are locally network-disabled.
  if (!hasRelationOptions(request, request.object)) return remote(request);
  if (request.cacheSource === 'cache') {
    if (request.operation === 'select') return executeCached(request, store);
    const queued = await queueWrite(request, store);
    state.tab.notify(database);
    return queued;
  }
  if (!state.networkEnabled) {
    if (request.operation === 'select' && state.options.persistence === 'indexeddb' && state.options.synchronizeTabs && state.tab.hasPrimary(database)) {
      try {
        const result = await state.tab.forwardRead(database, forwardableReadRequest(request));
        await store.refresh();
        return result;
      } catch {
        return executeCached(request, store);
      }
    }
    if (request.operation === 'select') return executeCached(request, store);
    const queued = await queueWrite(request, store);
    state.tab.notify(database);
    return queued;
  }
  // In a synchronized cache, the lease holder is the only tab allowed to use
  // the network. Secondary tabs forward reads and make durable local writes;
  // the primary observes the write notification and replays the queue.
  if (state.options.persistence === 'indexeddb' && state.options.synchronizeTabs && !state.tab.canReplay(database)) {
    if (request.operation === 'select') {
      try {
        const result = await state.tab.forwardRead(database, forwardableReadRequest(request));
        await store.refresh();
        return result;
      } catch {
        return executeCached(request, store);
      }
    }
    const queued = await queueWrite(request, store);
    state.tab.notify(database);
    return queued;
  }
  // A real network failure is retried by the first request only. Later reads
  // stay cache-backed and later writes are durably queued until that retry
  // succeeds, at which point normal draining resumes.
  if (state.recoveries.has(database)) {
    if (request.operation === 'select') return executeCached(request, store);
    const queued = await queueWrite(request, store);
    state.tab.notify(database);
    return queued;
  }
  await drain(request, state, store, database, remote);
  try {
    return await executeRemoteAndCache(request, state, store, database, remote);
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    if (isNetworkFailure(error)) {
      const recovered = await recoverNetwork(request, state, store, database, remote);
      if (recovered) return recovered;
      if (request.operation === 'select') return executeCached(request, store);
      const queued = await queueWrite(request, store);
      state.tab.notify(database);
      return queued;
    }
    if (request.operation === 'select' && !request.throwOnError && !isAbort) return executeCached(request, store);
    if (request.operation === 'select') throw error;
    const queued = await queueWrite(request, store);
    state.tab.notify(database);
    return queued;
  }
}

/**
 * Reports whether offline support is enabled for a client.
 *
 * @param {RelationalDb} client - The client instance to inspect.
 * @returns {boolean} `true` when {@link enableOffline} has been called and not shut down.
 *
 * @example
 * ```ts
 * if (!isOfflineEnabled(client)) await enableMemoryPersistence(client, options);
 * ```
 */
export function isOfflineEnabled(client: RelationalDb): boolean {
  return OFFLINE.has(client.app);
}

/** @internal Checks whether an app has relational offline support enabled. */
export function isOfflineEnabledForApp(app: object): boolean {
  return OFFLINE.has(app);
}

/**
 * Enables relation-scoped offline caching, local mutation queuing, and optional
 * cross-tab coordination for a data client.
 *
 * Relations omitted from `options.relations` continue to use normal requests.
 * Calling this again replaces the client's previous offline configuration.
 *
 * Cache-only filter support includes comparisons, membership, local text and
 * array matching, bitwise checks, nested paths, logical composition, ordering,
 * limits, ranges, single-row modifiers, and basic aggregates. `containedBy`
 * and range modifiers are not supported locally. Network-only modifiers
 * (`abortSignal`, `retry`, `throwOnError`, and `setHeader`) have no local effect.
 *
 * @param {RelationalDb} client - The client instance that will use offline behavior.
 * @param {RelationalOfflineOptions} options - Persistence, cache, tab-synchronization, and relation-key settings.
 * @returns {Promise<void>} A promise that resolves after the local store is ready.
 *
 * @example
 * ```ts
 * await enableOffline(client, {
 *   persistence: 'indexeddb',
 *   synchronizeTabs: true,
 *   relations: { users_1: { primaryKey: ['UUID'] } },
 * });
 * ```
 */
export async function enableOffline(client: RelationalDb, options: RelationalOfflineOptions): Promise<void> {
  await shutdownOffline(client);
  const state: State = {
    options: {
      persistence: options.persistence ?? 'indexeddb',
      cacheSizeBytes: options.cacheSizeBytes ?? Number.POSITIVE_INFINITY,
      synchronizeTabs: options.synchronizeTabs ?? false,
      relations: options.relations,
    },
    networkEnabled: true,
    stores: new Map(),
    requests: new Map(),
    subscribedDatabases: new Set(),
    drains: new Map(),
    recoveries: new Map(),
    recoveredMutations: new Map(),
    waiters: new Set(),
    tab: new TabLease(options.synchronizeTabs === true),
    remote: defaultRemoteExecutor,
  };
  OFFLINE.set(client.app, state);
  const bootstrap: RelationalOfflineRequest = {
    app: client.app,
    schema: client.schemaName,
    object: '',
    operation: 'select',
    projection: { all: true, columns: [], aggregates: [], relations: [] },
    qbe: {},
    returnRows: false,
  };
  const { store, database } = await stateFor(bootstrap);
  if (state.remote) await drain(bootstrap, state, store, database, state.remote);
}

/**
 * Creates an IndexedDB-backed offline configuration for {@link enableOffline}.
 *
 * @param {RelationalPersistentCacheOptions} options - Cache size, tab synchronization, and relation-key settings.
 * @returns {RelationalOfflineOptions} Offline options with `persistence` set to `'indexeddb'`.
 *
 * @example
 * ```ts
 * await enableOffline(client, persistentLocalCache({
 *   relations: { users_1: { primaryKey: ['UUID'] } },
 *   synchronizeTabs: true,
 * }));
 * ```
 */
export function persistentLocalCache(options: RelationalPersistentCacheOptions): RelationalOfflineOptions {
  return { ...options, persistence: 'indexeddb' };
}

/**
 * Enables IndexedDB-backed offline persistence.
 *
 * This convenience function is equivalent to calling {@link enableOffline} with
 * {@link persistentLocalCache}.
 *
 * @param {RelationalDb} client - The client instance to configure.
 * @param {RelationalPersistentCacheOptions} options - Cache size, tab synchronization, and relation-key settings.
 * @returns {Promise<void>} A promise that resolves after IndexedDB is ready.
 *
 * @example
 * ```ts
 * await enableIndexedDbPersistence(client, {
 *   relations: { users_1: { primaryKey: ['UUID'] } },
 * });
 * ```
 */
export function enableIndexedDbPersistence(client: RelationalDb, options: RelationalPersistentCacheOptions): Promise<void> {
  return enableOffline(client, { ...options, persistence: 'indexeddb' });
}

/**
 * Enables in-memory offline persistence for the current page lifetime.
 *
 * @param {RelationalDb} client - The client instance to configure.
 * @param {Omit<RelationalOfflineOptions, 'persistence'>} options - Cache size, tab synchronization, and relation-key settings.
 * @returns {Promise<void>} A promise that resolves after the in-memory store is ready.
 *
 * @example
 * ```ts
 * await enableMemoryPersistence(client, {
 *   relations: { users_1: { primaryKey: ['UUID'] } },
 * });
 * ```
 */
export function enableMemoryPersistence(client: RelationalDb, options: Omit<RelationalOfflineOptions, 'persistence'>): Promise<void> {
  return enableOffline(client, { ...options, persistence: 'memory' });
}

/**
 * Clears rows, query targets, queued mutations, and overlays from the client's
 * currently opened offline stores.
 *
 * @param {RelationalDb} client - The client instance whose local stores are cleared.
 * @returns {Promise<void>} A promise that resolves after the stores are empty.
 *
 * @example
 * ```ts
 * await clearIndexedDbPersistence(client);
 * ```
 */
export async function clearIndexedDbPersistence(client: RelationalDb): Promise<void> {
  const state = OFFLINE.get(client.app);
  if (!state) return;
  await Promise.all([...state.stores.values()].map(store => store.clear()));
}

/**
 * Disables network use for configured offline relations on this tab.
 *
 * Reads use local cache and writes queue locally until {@link enableNetwork} is
 * called. Relations not configured for offline support retain normal behavior.
 *
 * @param {RelationalDb} client - The client instance to place in local-only mode.
 * @returns {Promise<void>} A promise that resolves after the tab releases its replay lease.
 *
 * @example
 * ```ts
 * await disableNetwork(client);
 * await client.from('users_1').update({ AGE: 30 }).eq('UUID', 1);
 * ```
 */
export async function disableNetwork(client: RelationalDb): Promise<void> {
  const state = OFFLINE.get(client.app);
  if (!state) throw offlineError('Offline support is not enabled for this relational client', 'failed-precondition');
  state.networkEnabled = false;
  // A network-disabled tab must not retain the primary replay lease. Otherwise it
  // prevents an online sibling tab from replaying mutations written to IndexedDB.
  if (state.activeDatabase) {
    state.tab.release(state.activeDatabase);
    state.tab.notify(state.activeDatabase);
  }
}

/**
 * Re-enables network use for configured offline relations and requests replay
 * of queued mutations by the primary tab.
 *
 * @param {RelationalDb} client - The client instance to return to network mode.
 * @returns {Promise<void>} A promise that resolves after replay has been requested.
 *
 * @example
 * ```ts
 * await enableNetwork(client);
 * await waitForPendingWrites(client);
 * ```
 */
export async function enableNetwork(client: RelationalDb): Promise<void> {
  const state = OFFLINE.get(client.app);
  if (!state) throw offlineError('Offline support is not enabled for this relational client', 'failed-precondition');
  state.networkEnabled = true;
  if (state.remote) {
    const database = state.activeDatabase;
    const store = database ? state.stores.get(database) : undefined;
    const request = database ? state.requests.get(database) : undefined;
    if (database && store && request) await drain(request, state, store, database, state.remote);
    // If this tab did not win the lease, wake its online sibling, which will
    // refresh the durable queue and replay it as the primary tab.
    if (database) state.tab.notify(database);
  }
}

/**
 * Waits until all locally queued mutations for a client have been acknowledged
 * or otherwise removed from its active offline stores.
 *
 * @param {RelationalDb} client - The client instance whose pending writes are observed.
 * @returns {Promise<void>} A promise that resolves when no pending local mutations remain.
 *
 * @example
 * ```ts
 * await enableNetwork(client);
 * await waitForPendingWrites(client);
 * ```
 */
export async function waitForPendingWrites(client: RelationalDb): Promise<void> {
  const state = OFFLINE.get(client.app);
  if (!state) return;
  const pending = [...state.stores.values()].some(store => store.pending().length > 0);
  if (!pending) return;
  return new Promise<void>(resolve => state.waiters.add(resolve));
}

/**
 * Disables offline support for a client and closes its local stores.
 *
 * Persisted IndexedDB data is retained; use {@link clearIndexedDbPersistence}
 * first when it must be removed.
 *
 * @param {RelationalDb} client - The client instance to detach from offline support.
 * @returns {Promise<void>} A promise that resolves after local resources are closed.
 *
 * @example
 * ```ts
 * await shutdownOffline(client);
 * ```
 */
export async function shutdownOffline(client: RelationalDb): Promise<void> {
  const state = OFFLINE.get(client.app);
  if (!state) return;
  OFFLINE.delete(client.app);
  state.tab.shutdown();
  await Promise.all([...state.stores.values()].map(store => store.close()));
  for (const resolve of state.waiters) resolve();
}
