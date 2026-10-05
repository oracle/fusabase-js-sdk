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

export class OfflineTabCoordinator {
  private readonly tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  private storageKey: string;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isPrimary = false;
  private started = false;
  private networkEnabled = true;
  private readonly leaseMs = 5000;
  private primaryStateListener: ((isPrimary: boolean) => void) | null = null;

  constructor(
    private readonly databaseName: string,
    private readonly synchronizeTabs: boolean,
    private userId: string = 'anonymous'
  ) {
    this.storageKey = this.storageKeyForUser(userId);
  }

  start(): void {
    this.started = true;
    if (!this.synchronizeTabs || typeof window === 'undefined') {
      this.setPrimary(true);
      return;
    }
    window.addEventListener('storage', this.handleStorageEvent);
    window.addEventListener('pagehide', this.handlePageHide);
    this.tryAcquireLease();
    this.heartbeatTimer = setInterval(() => this.tryAcquireLease(), 2000);
  }

  shutdown(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (typeof window !== 'undefined' && this.isPrimary) {
      this.releaseLease();
    }
    if (this.synchronizeTabs && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent);
      window.removeEventListener('pagehide', this.handlePageHide);
    }
    this.started = false;
    this.isPrimary = false;
    this.primaryStateListener?.(false);
  }

  get canRunRemoteStore(): boolean {
    return this.isPrimary;
  }

  setPrimaryStateListener(listener: (isPrimary: boolean) => void): void {
    this.primaryStateListener = listener;
    listener(this.isPrimary);
  }

  setUserId(userId: string): void {
    if (this.userId === userId) return;
    if (!this.synchronizeTabs) {
      this.userId = userId;
      this.storageKey = this.storageKeyForUser(userId);
      this.setPrimary(true);
      return;
    }
    this.releaseLease();
    this.userId = userId;
    this.storageKey = this.storageKeyForUser(userId);
    this.setPrimary(false);
    if (this.started) {
      this.tryAcquireLease();
    }
  }

  setNetworkEnabled(enabled: boolean): void {
    if (this.networkEnabled === enabled) return;
    this.networkEnabled = enabled;

    if (!this.synchronizeTabs) {
      this.setPrimary(enabled);
      return;
    }

    if (!enabled) {
      this.releaseLease();
      this.setPrimary(false);
      return;
    }

    if (this.started) {
      this.tryAcquireLease();
    }
  }

  private readonly handlePageHide = () => {
    this.releaseLease();
    this.setPrimary(false);
  };

  private readonly handleStorageEvent = (event: StorageEvent) => {
    if (!this.started || event.storageArea !== window.localStorage || event.key !== this.storageKey) {
      return;
    }
    if (!this.networkEnabled) {
      this.setPrimary(false);
      return;
    }

    const lease = this.parseLease(event.newValue);
    if (!lease || lease.expiresAt <= Date.now() || lease.tabId === this.tabId) {
      this.tryAcquireLease();
      return;
    }

    this.setPrimary(false);
  };

  private tryAcquireLease(): void {
    if (!this.networkEnabled) {
      this.releaseLease();
      this.setPrimary(false);
      return;
    }
    if (typeof window === 'undefined') {
      this.isPrimary = true;
      return;
    }
    const now = Date.now();
    const lease = this.readLease();
    if (!lease || lease.expiresAt <= now || lease.tabId === this.tabId) {
      const nextLease = {
        tabId: this.tabId,
        expiresAt: now + this.leaseMs,
      };
      window.localStorage.setItem(this.storageKey, JSON.stringify(nextLease));
      this.setPrimary(true);
      return;
    }
    this.setPrimary(false);
  }

  private setPrimary(isPrimary: boolean): void {
    if (this.isPrimary === isPrimary) return;
    this.isPrimary = isPrimary;
    this.primaryStateListener?.(isPrimary);
  }

  private releaseLease(): void {
    if (typeof window === 'undefined') return;
    const lease = this.readLease();
    if (lease?.tabId === this.tabId) {
      window.localStorage.removeItem(this.storageKey);
    }
  }

  private readLease(): { tabId: string; expiresAt: number } | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(this.storageKey);
    return this.parseLease(raw);
  }

  private parseLease(raw: string | null): { tabId: string; expiresAt: number } | null {
    if (!raw) return null;
    try {
      const lease = JSON.parse(raw);
      if (!lease || typeof lease.tabId !== 'string' || typeof lease.expiresAt !== 'number') {
        return null;
      }
      return lease;
    } catch {
      return null;
    }
  }

  private storageKeyForUser(userId: string): string {
    return `${this.databaseName}-${userId}-primary-tab`;
  }
}
