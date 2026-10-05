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

export type OfflineOnlineState = 'unknown' | 'online' | 'offline';

export type OfflineOnlineStateHandler = (state: OfflineOnlineState) => void;

const MAX_REMOTE_FAILURES = 1;
const ONLINE_STATE_TIMEOUT_MS = 10 * 1000;

export class OfflineOnlineStateTracker {
  private stateValue: OfflineOnlineState = 'unknown';
  private remoteFailures = 0;
  private onlineStateTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly onStateChange: OfflineOnlineStateHandler = () => undefined) {}

  get state(): OfflineOnlineState {
    return this.stateValue;
  }

  handleRemoteAttemptStart(): void {
    if (this.remoteFailures === 0) {
      this.setAndBroadcast('unknown');
      this.startOnlineStateTimer();
    }
  }

  handleRemoteSuccess(): void {
    this.set('online');
  }

  handleRemoteFailure(): void {
    if (this.stateValue === 'online') {
      this.setAndBroadcast('unknown');
      return;
    }
    this.remoteFailures += 1;
    if (this.remoteFailures >= MAX_REMOTE_FAILURES) {
      this.clearOnlineStateTimer();
      this.setAndBroadcast('offline');
    }
  }

  set(state: OfflineOnlineState): void {
    this.clearOnlineStateTimer();
    this.remoteFailures = 0;
    this.setAndBroadcast(state);
  }

  shutdown(): void {
    this.clearOnlineStateTimer();
  }

  private startOnlineStateTimer(): void {
    if (this.onlineStateTimer != null || this.stateValue === 'offline') return;
    this.onlineStateTimer = setTimeout(() => {
      this.onlineStateTimer = null;
      if (this.stateValue === 'unknown') {
        this.setAndBroadcast('offline');
      }
    }, ONLINE_STATE_TIMEOUT_MS);
  }

  private clearOnlineStateTimer(): void {
    if (this.onlineStateTimer != null) {
      clearTimeout(this.onlineStateTimer);
      this.onlineStateTimer = null;
    }
  }

  private setAndBroadcast(state: OfflineOnlineState): void {
    if (state === this.stateValue) return;
    this.stateValue = state;
    this.onStateChange(state);
  }
}
