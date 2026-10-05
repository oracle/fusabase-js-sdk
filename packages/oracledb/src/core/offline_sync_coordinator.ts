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
import type { OfflineWriteBatchSource, OfflineWriteMutation } from '../model/index.js';

export type ListenOptions = {
  includeMetadataChanges?: boolean;
  source?: 'default' | 'cache';
  waitForSyncWhenOnline?: boolean;
};

export type ListenObserver<T> = {
  next: (snapshot: T) => void;
  error?: (error: Error) => void;
};

export type Unsubscribe = () => void;

export type ReadSource = 'default' | 'cache' | 'server';

export type ListenTarget<AppModelType = any> =
  | Query<AppModelType, any>
  | CollectionReference<AppModelType, any>
  | DocumentReference<AppModelType, any>;

export type SnapshotForTarget<AppModelType = any> =
  | QuerySnapshot<AppModelType, any>
  | DocumentSnapshot<AppModelType>;

export type OfflineSyncCoordinatorDelegate = {
  write(mutations: OfflineWriteMutation[], source?: OfflineWriteBatchSource): Promise<void>;
  listen<AppModelType>(
    target: ListenTarget<AppModelType>,
    options: ListenOptions,
    observer: ListenObserver<SnapshotForTarget<AppModelType>>
  ): Unsubscribe | null;
  getDocument<AppModelType>(
    ref: DocumentReference<AppModelType>,
    source?: ReadSource
  ): Promise<DocumentSnapshot<AppModelType>>;
  getDocuments<AppModelType>(
    query: Query<AppModelType, any> | CollectionReference<AppModelType, any>,
    source?: ReadSource
  ): Promise<QuerySnapshot<AppModelType, any>>;
  waitForPendingWrites(): Promise<void>;
  resumeNetwork(): Promise<void>;
  pauseNetwork(): Promise<void>;
  hasPendingWritesForDocument(ref: DocumentReference<any, any>): Promise<boolean>;
  getPendingCacheSnapshotForQuery<AppModelType>(
    query: Query<AppModelType, any> | CollectionReference<AppModelType, any>
  ): Promise<QuerySnapshot<AppModelType, any> | null>;
  cacheDocumentSnapshot(snapshot: DocumentSnapshot<any, any>): Promise<void>;
  cacheQuerySnapshot(snapshot: QuerySnapshot<any, any>): Promise<void>;
};

export class OfflineSyncCoordinator {
  constructor(private readonly delegate: OfflineSyncCoordinatorDelegate) {}

  write(
    mutations: OfflineWriteMutation[],
    source: OfflineWriteBatchSource = 'individual'
  ): Promise<void> {
    return this.delegate.write(mutations, source);
  }

  listen<AppModelType>(
    target: ListenTarget<AppModelType>,
    options: ListenOptions,
    observer: ListenObserver<SnapshotForTarget<AppModelType>>
  ): Unsubscribe | null {
    return this.delegate.listen(target, options, observer);
  }

  getDocument<AppModelType>(
    ref: DocumentReference<AppModelType>,
    source: ReadSource = 'default'
  ): Promise<DocumentSnapshot<AppModelType>> {
    return this.delegate.getDocument(ref, source);
  }

  getDocuments<AppModelType>(
    query: Query<AppModelType, any> | CollectionReference<AppModelType, any>,
    source: ReadSource = 'default'
  ): Promise<QuerySnapshot<AppModelType, any>> {
    return this.delegate.getDocuments(query, source);
  }

  waitForPendingWrites(): Promise<void> {
    return this.delegate.waitForPendingWrites();
  }

  resumeNetwork(): Promise<void> {
    return this.delegate.resumeNetwork();
  }

  pauseNetwork(): Promise<void> {
    return this.delegate.pauseNetwork();
  }

  hasPendingWritesForDocument(ref: DocumentReference<any, any>): Promise<boolean> {
    return this.delegate.hasPendingWritesForDocument(ref);
  }

  getPendingCacheSnapshotForQuery<AppModelType>(
    query: Query<AppModelType, any> | CollectionReference<AppModelType, any>
  ): Promise<QuerySnapshot<AppModelType, any> | null> {
    return this.delegate.getPendingCacheSnapshotForQuery(query);
  }

  cacheDocumentSnapshot(snapshot: DocumentSnapshot<any, any>): Promise<void> {
    return this.delegate.cacheDocumentSnapshot(snapshot);
  }

  cacheQuerySnapshot(snapshot: QuerySnapshot<any, any>): Promise<void> {
    return this.delegate.cacheQuerySnapshot(snapshot);
  }
}
