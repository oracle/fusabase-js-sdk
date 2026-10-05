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

import type { OfflineOnlineState } from './offline_online_state_tracker.js';

export type OfflineSharedQueryState = 'not-current' | 'current' | 'rejected';
export type OfflineSharedMutationState = 'pending' | 'acknowledged' | 'rejected';

export type OfflineSharedTargetDescriptor = {
  targetId: number;
  userId: string;
  targetType?: 'document' | 'query';
  canonicalId: string;
  canonicalQuery: string;
  path?: string;
  filters?: Array<{ field: string | null; op: string; value: unknown }>;
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  limit?: number | null;
};

export type OfflineSharedMutationEvent = {
  batchId: number;
  userId: string;
  state: OfflineSharedMutationState;
  affectedPaths: string[];
  error?: string;
};

export type OfflineSharedQueryEvent = {
  targetId: number;
  userId: string;
  state: OfflineSharedQueryState;
  affectedPaths: string[];
  error?: string;
};

export type OfflineSharedCacheEvent = {
  userId: string;
  targetId?: number;
  affectedPaths: string[];
};

type OfflineSharedClientStateHandlers = {
  onActiveTargetsChanged?: (added: OfflineSharedTargetDescriptor[], removed: number[]) => void;
  onMutationState?: (event: OfflineSharedMutationEvent) => void;
  onQueryState?: (event: OfflineSharedQueryEvent) => void;
  onOnlineState?: (state: OfflineOnlineState) => void;
  onCacheChanged?: (event: OfflineSharedCacheEvent) => void;
};

type ClientStateRecord = {
  clientId: string;
  userId: string;
  updatedAt: number;
  activeTargets: OfflineSharedTargetDescriptor[];
};

export class OfflineSharedClientState {
  readonly clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  private readonly localClientKey: string;
  private readonly clientPrefix: string;
  private readonly mutationPrefix: string;
  private readonly queryPrefix: string;
  private readonly onlineStateKey: string;
  private readonly cacheChangeKey: string;
  private readonly activeClients = new Map<string, ClientStateRecord>();
  private readonly localTargets = new Map<number, OfflineSharedTargetDescriptor>();
  private knownActiveTargetIds = new Set<number>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private userId = 'anonymous';

  constructor(
    databaseName: string,
    private readonly synchronizeTabs: boolean,
    private readonly handlers: OfflineSharedClientStateHandlers = {}
  ) {
    const prefix = `${databaseName}-shared`;
    this.clientPrefix = `${prefix}-client-`;
    this.mutationPrefix = `${prefix}-mutation-`;
    this.queryPrefix = `${prefix}-query-`;
    this.onlineStateKey = `${prefix}-online-state`;
    this.cacheChangeKey = `${prefix}-cache-change`;
    this.localClientKey = `${this.clientPrefix}${this.clientId}`;
  }

  start(userId = 'anonymous'): void {
    this.userId = userId;
    if (!this.canUseWebStorage()) return;
    this.started = true;
    this.loadExistingClients();
    this.persistLocalClientState();
    this.knownActiveTargetIds = this.activeTargetIds();
    window.addEventListener('storage', this.handleStorageEvent);
    window.addEventListener('pagehide', this.handlePageHide);
    this.heartbeatTimer = setInterval(() => {
      this.pruneStaleClients();
      this.persistLocalClientState();
    }, 4000);
  }

  shutdown(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.canUseWebStorage() && this.started) {
      window.removeEventListener('storage', this.handleStorageEvent);
      window.removeEventListener('pagehide', this.handlePageHide);
      window.localStorage.removeItem(this.localClientKey);
    }
    this.started = false;
    this.activeClients.clear();
    this.localTargets.clear();
    this.knownActiveTargetIds.clear();
  }

  setUserId(userId: string): void {
    if (this.userId === userId) return;
    this.userId = userId;
    this.localTargets.clear();
    this.knownActiveTargetIds = this.activeTargetIds();
    this.persistLocalClientState();
  }

  addLocalQueryTarget(target: OfflineSharedTargetDescriptor): void {
    this.localTargets.set(target.targetId, { ...target, userId: target.userId ?? this.userId });
    this.persistLocalClientState();
    this.knownActiveTargetIds = this.activeTargetIds();
  }

  removeLocalQueryTarget(targetId: number): void {
    this.localTargets.delete(targetId);
    this.persistLocalClientState();
    this.knownActiveTargetIds = this.activeTargetIds();
  }

  isActiveQueryTarget(targetId: number): boolean {
    return this.getAllActiveTargetDescriptors().some(target => target.targetId === targetId);
  }

  getAllActiveTargetDescriptors(): OfflineSharedTargetDescriptor[] {
    const byTargetId = new Map<number, OfflineSharedTargetDescriptor>();
    for (const client of this.currentClientRecords()) {
      for (const target of client.activeTargets) {
        if (target.userId !== this.userId) continue;
        byTargetId.set(target.targetId, target);
      }
    }
    for (const target of this.localTargets.values()) {
      if (target.userId !== this.userId) continue;
      byTargetId.set(target.targetId, target);
    }
    return [...byTargetId.values()];
  }

  addPendingMutation(batchId: number, userId: string, affectedPaths: string[]): void {
    this.persistMutationState({ batchId, userId, affectedPaths, state: 'pending' });
  }

  updateMutationState(event: OfflineSharedMutationEvent): void {
    this.persistMutationState(event);
  }

  updateQueryState(event: OfflineSharedQueryEvent): void {
    this.persistEvent(`${this.queryPrefix}${event.userId}-${event.targetId}`, event);
  }

  setOnlineState(state: OfflineOnlineState): void {
    this.persistEvent(this.onlineStateKey, { clientId: this.clientId, userId: this.userId, state });
  }

  notifyCacheChanged(event: OfflineSharedCacheEvent): void {
    this.persistEvent(this.cacheChangeKey, event);
  }

  private readonly handlePageHide = () => {
    this.shutdown();
  };

  private readonly handleStorageEvent = (event: StorageEvent) => {
    if (event.storageArea !== window.localStorage || !event.key || event.key === this.localClientKey) {
      return;
    }
    if (event.key.startsWith(this.clientPrefix)) {
      this.handleClientStateEvent(event.key, event.newValue);
    } else if (event.key.startsWith(this.mutationPrefix) && event.newValue) {
      const parsed = this.parseEvent<OfflineSharedMutationEvent>(event.newValue);
      if (parsed) this.handlers.onMutationState?.(parsed);
    } else if (event.key.startsWith(this.queryPrefix) && event.newValue) {
      const parsed = this.parseEvent<OfflineSharedQueryEvent>(event.newValue);
      if (parsed) this.handlers.onQueryState?.(parsed);
    } else if (event.key === this.onlineStateKey && event.newValue) {
      const parsed = this.parseEvent<{ clientId: string; userId?: string; state: OfflineOnlineState }>(event.newValue);
      if (parsed && parsed.userId === this.userId && this.activeClients.has(parsed.clientId)) {
        this.handlers.onOnlineState?.(parsed.state);
      }
    } else if (event.key === this.cacheChangeKey && event.newValue) {
      const parsed = this.parseEvent<OfflineSharedCacheEvent>(event.newValue);
      if (parsed) this.handlers.onCacheChanged?.(parsed);
    }
  };

  private handleClientStateEvent(key: string, value: string | null): void {
    const before = new Set(this.knownActiveTargetIds);
    const clientId = key.slice(this.clientPrefix.length);
    if (value == null) {
      this.activeClients.delete(clientId);
    } else {
      const parsed = this.parseClientState(value);
      if (parsed) {
        this.activeClients.set(parsed.clientId, parsed);
      }
    }
    const after = this.activeTargetIds();
    this.knownActiveTargetIds = after;
    const added = [...after].filter(targetId => !before.has(targetId))
      .map(targetId => this.getAllActiveTargetDescriptors().find(target => target.targetId === targetId))
      .filter((target): target is OfflineSharedTargetDescriptor => Boolean(target));
    const removed = [...before].filter(targetId => !after.has(targetId));
    if (added.length > 0 || removed.length > 0) {
      this.handlers.onActiveTargetsChanged?.(added, removed);
    }
  }

  private persistLocalClientState(): void {
    if (!this.canUseWebStorage()) return;
    const record: ClientStateRecord = {
      clientId: this.clientId,
      userId: this.userId,
      updatedAt: Date.now(),
      activeTargets: [...this.localTargets.values()].filter(target => target.userId === this.userId),
    };
    this.activeClients.set(this.clientId, record);
    window.localStorage.setItem(this.localClientKey, JSON.stringify(record));
  }

  private persistMutationState(event: OfflineSharedMutationEvent): void {
    this.persistEvent(`${this.mutationPrefix}${event.userId}-${event.batchId}`, event);
  }

  private pruneStaleClients(): void {
    const now = Date.now();
    const before = new Set(this.knownActiveTargetIds);
    for (const [clientId, client] of this.activeClients) {
      if (clientId !== this.clientId && now - client.updatedAt >= 12000) {
        this.activeClients.delete(clientId);
      }
    }
    const after = this.activeTargetIds();
    this.knownActiveTargetIds = after;
    const removed = [...before].filter(targetId => !after.has(targetId));
    if (removed.length > 0) {
      this.handlers.onActiveTargetsChanged?.([], removed);
    }
  }

  private persistEvent(key: string, payload: unknown): void {
    if (!this.canUseWebStorage()) return;
    window.localStorage.setItem(key, JSON.stringify({
      payload,
      writtenBy: this.clientId,
      writtenAt: Date.now(),
      nonce: Math.random().toString(36).slice(2),
    }));
  }

  private loadExistingClients(): void {
    if (!this.canUseWebStorage()) return;
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(this.clientPrefix) || key === this.localClientKey) continue;
      const value = window.localStorage.getItem(key);
      const parsed = value ? this.parseClientState(value) : null;
      if (parsed) {
        this.activeClients.set(parsed.clientId, parsed);
      }
    }
  }

  private activeTargetIds(): Set<number> {
    return new Set(this.getAllActiveTargetDescriptors().map(target => target.targetId));
  }

  private currentClientRecords(): ClientStateRecord[] {
    const now = Date.now();
    return [...this.activeClients.values()]
      .filter(client => client.userId === this.userId && now - client.updatedAt < 12000);
  }

  private parseClientState(value: string): ClientStateRecord | null {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed.clientId !== 'string') return null;
      return {
        clientId: parsed.clientId,
        userId: parsed.userId ?? 'anonymous',
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
        activeTargets: Array.isArray(parsed.activeTargets)
          ? parsed.activeTargets.map((target: OfflineSharedTargetDescriptor) => ({
            ...target,
            userId: target.userId ?? parsed.userId ?? 'anonymous',
          }))
          : [],
      };
    } catch {
      return null;
    }
  }

  private parseEvent<T>(value: string): T | null {
    try {
      const parsed = JSON.parse(value);
      if (parsed?.writtenBy === this.clientId) return null;
      return parsed?.payload as T;
    } catch {
      return null;
    }
  }

  private canUseWebStorage(): boolean {
    return this.synchronizeTabs && typeof window !== 'undefined' && !!window.localStorage;
  }
}
