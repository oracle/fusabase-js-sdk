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

import { Query } from '../collection/reference.js';
import { CollectionReference } from '../collection/reference.js';
import { QuerySnapshot } from '../collection/snapshot.js';
import { DocumentReference } from '../document/reference.js';
import { DocumentSnapshot, QueryDocumentSnapshot } from '../document/snapshot.js';
import { SnapshotMetadata } from '../listener/snapshot.js';
import { OracledbDocumentKey } from '../model/index.js';
import { OfflineLocalStore } from './offline_local_store.js';
import { getFieldValue, matchesQueryFilters } from './offline_query_matcher.js';
import { OfflineCachedDocument, OfflineQueryTarget } from './types.js';

export function canonicalIdForTarget(target: any): string {
  if (target instanceof DocumentReference) {
    return `doc:${target.path}`;
  }
  const queryLike = target as any;
  return JSON.stringify({
    type: 'query',
    path: Array.isArray(queryLike._path) ? queryLike._path.join('/') : '',
    conditions: queryLike._conditions ?? [],
    explicitOrder: queryLike._explicitOrder ?? [],
    limit: queryLike._limit ?? 0,
    joins: queryLike._joins ?? [],
    aggregate: queryLike._aggregate ?? [],
    vectorSearch: queryLike._vectorSearch ?? null,
  });
}

export class OfflineQueryEngine {
  constructor(private readonly localStore: OfflineLocalStore) {}

  async getDocumentFromCache<AppModelType>(
    ref: DocumentReference<AppModelType>,
    forceFromCache?: boolean
  ): Promise<DocumentSnapshot<AppModelType>> {
    const key = OracledbDocumentKey.fromPath(ref.path);
    const cached = await this.localStore.getLocalDocument(key);
    const target = this.localStore.findTargetForCanonical(canonicalIdForTarget(ref));
    const fromCache = forceFromCache ?? target?.snapshotVersion == null;
    if (!cached || cached.data == null || cached.documentState === 'noDocument') {
      return new DocumentSnapshot(null, ref, new SnapshotMetadata(fromCache, this.hasPendingWrites(cached)));
    }
    return new DocumentSnapshot(
      {
        DOCUMENT: cached.data,
        VERSION: cached.version.value,
        LAST_MODIFIED: cached.updateTime,
        updateTime: cached.updateTime,
        commitTime: cached.commitTime,
        ASOF: cached.readTime,
      },
      ref,
      new SnapshotMetadata(fromCache, this.hasPendingWrites(cached))
    );
  }

  async getDocumentsFromCache<AppModelType, DbModelType>(
    query: Query<AppModelType, any>,
    forceFromCache?: boolean
  ): Promise<QuerySnapshot<AppModelType, any>> {
    const queryLike = query as any;
    const hasUnsupportedConstraints =
      (queryLike._joins?.length ?? 0) > 0 ||
      (queryLike._aggregate?.length ?? 0) > 0 ||
      queryLike._vectorSearch;

    if (hasUnsupportedConstraints) {
      throw new Error('OfflineQueryEngine cache reads do not support joins, aggregates, or vector search');
    }

    const target = this.localStore.findTargetForCanonical(canonicalIdForTarget(query));
    const collectionPath = Array.isArray(queryLike._path) ? queryLike._path.join('/') : '';
    let cachedDocs = target
      ? await this.getDocumentsForTarget(target, collectionPath)
      : await this.localStore.getLocalDocumentsMatchingPrefix(collectionPath);
    cachedDocs = cachedDocs.filter(document => document.data != null && document.documentState !== 'noDocument');
    cachedDocs = this.applyFilters(cachedDocs, queryLike._conditions ?? []);
    cachedDocs = this.applyOrdering(cachedDocs, queryLike._explicitOrder ?? []);
    if (queryLike._limit > 0) {
      cachedDocs = cachedDocs.slice(0, queryLike._limit);
    }
    const collectionRef = new CollectionReference(queryLike.oracledb, collectionPath);
    collectionRef.converter = queryLike.converter;
    const docSnaps = cachedDocs.map(cached => {
      const ref = new DocumentReference(
        queryLike.oracledb,
        cached.key.segments[cached.key.segments.length - 1],
        collectionRef
      );
      ref.converter = queryLike.converter;
      return new QueryDocumentSnapshot(
        {
          DOCUMENT: cached.data,
          VERSION: cached.version.value,
          LAST_MODIFIED: cached.updateTime,
          updateTime: cached.updateTime,
          commitTime: cached.commitTime,
          ASOF: cached.readTime,
        },
        ref,
        new SnapshotMetadata(forceFromCache ?? target?.snapshotVersion == null, this.hasPendingWrites(cached))
      );
    });
    const hasPendingWrites = cachedDocs.some(doc => this.hasPendingWrites(doc));
    return new QuerySnapshot(
      docSnaps,
      query,
      new SnapshotMetadata(forceFromCache ?? target?.snapshotVersion == null, hasPendingWrites)
    );
  }

  private async getDocumentsForTarget(target: OfflineQueryTarget, collectionPath: string): Promise<OfflineCachedDocument[]> {
    const paths = this.localStore.getTargetDocumentPaths(target.targetId);
    const docs = new Map<string, OfflineCachedDocument>();
    for (const path of paths) {
      const doc = await this.localStore.getLocalDocument(OracledbDocumentKey.fromPath(path));
      if (doc) docs.set(path, doc);
    }
    const localDocs = await this.localStore.getLocalDocumentsMatchingPrefix(collectionPath);
    for (const doc of localDocs) {
      if (doc.hasLocalMutations || doc.hasCommittedMutations) {
        docs.set(doc.key.path, doc);
      }
    }
    return [...docs.values()];
  }

  private hasPendingWrites(document: OfflineCachedDocument | null | undefined): boolean {
    return Boolean(document?.hasLocalMutations);
  }

  private applyFilters(
    documents: OfflineCachedDocument[],
    conditions: Array<{ field: string | null; op: string; value: any }>
  ): OfflineCachedDocument[] {
    if (conditions.some(condition => condition.field == null)) {
      throw new Error('OfflineQueryEngine cache reads do not support composite filters yet');
    }
    return documents.filter(document => matchesQueryFilters(document.data, conditions));
  }

  private applyOrdering(
    documents: OfflineCachedDocument[],
    explicitOrder: Array<{ field: string; direction: 'asc' | 'desc' }>
  ): OfflineCachedDocument[] {
    if (explicitOrder.length === 0) {
      return [...documents].sort((left, right) => left.key.path.localeCompare(right.key.path));
    }
    return documents
      .filter(document =>
        explicitOrder.every(order => getFieldValue(document.data, order.field) !== undefined)
      )
      .sort((left, right) => {
        for (const order of explicitOrder) {
          const leftValue = getFieldValue(left.data, order.field);
          const rightValue = getFieldValue(right.data, order.field);
          const comparison = this.compareValues(leftValue, rightValue);
          if (comparison !== 0) {
            return order.direction === 'desc' ? -comparison : comparison;
          }
        }
        return left.key.path.localeCompare(right.key.path);
      });
  }

  private compareValues(left: any, right: any): number {
    if (left === right) return 0;
    if (left == null) return -1;
    if (right == null) return 1;
    if (left instanceof Date && right instanceof Date) {
      return left.getTime() - right.getTime();
    }
    if (typeof left === 'number' && typeof right === 'number') {
      return left - right;
    }
    return String(left).localeCompare(String(right));
  }

}
