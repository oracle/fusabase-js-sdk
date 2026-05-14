
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

/**
 * Metadata about a Oracledb snapshot.
 * Provides information on whether the data came from cache
 * and whether it includes pending local writes.
 */
export declare class SnapshotMetadata {
  /**
   * True if the snapshot was created from cached data
   * rather than guaranteed up-to-date server data.
   *
   * If your listener has opted into metadata updates
   * (via `SnapshotListenOptions.includeMetadataChanges`),
   * you will receive another snapshot with `fromCache = false`
   * once fresh data is received from the backend.
   */
  readonly fromCache: boolean;

  /**
   * True if the snapshot contains the result of local writes
   * (for example `set()` or `update()` calls) that have not yet
   * been committed to the backend.
   *
   * If your listener has opted into metadata updates,
   * you will receive another snapshot with `hasPendingWrites = false`
   * once the writes have been committed successfully.
   */
  readonly hasPendingWrites: boolean;

  /**
   * Returns `true` if this `SnapshotMetadata` is equal
   * to the provided one (both `fromCache` and `hasPendingWrites` match).
   *
   * @param other - The `SnapshotMetadata` to compare against.
   */
  isEqual(other: SnapshotMetadata): boolean;
}
