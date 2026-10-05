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

import { DocumentData } from '../types/common.js';
import { FieldPath } from '../field/path.js';
import { OracledbDocumentKey } from './offline_document_key.js';
import { OracledbWritePrecondition } from './write_precondition.js';
import { OracledbDocumentVersion } from './offline_version.js';
import type { OfflineCachedDocument } from '../local/types.js';

export type OfflineTransformOperationType =
  | 'serverTimestamp'
  | 'increment'
  | 'arrayUnion'
  | 'arrayRemove';

export class OracledbFieldTransform {
  constructor(
    readonly field: FieldPath | string,
    readonly operation: OfflineTransformOperationType,
    readonly operand?: unknown
  ) {}
}

export abstract class OfflineWriteMutation {
  abstract readonly type: 'set' | 'patch' | 'delete' | 'transform';

  protected constructor(
    readonly key: OracledbDocumentKey,
    readonly precondition: OracledbWritePrecondition,
    readonly fieldTransforms: OracledbFieldTransform[] = []
  ) {}
}

export class OfflineSetWrite extends OfflineWriteMutation {
  readonly type = 'set' as const;

  constructor(
    key: OracledbDocumentKey,
    readonly data: DocumentData,
    precondition: OracledbWritePrecondition,
    fieldTransforms: OracledbFieldTransform[] = []
  ) {
    super(key, precondition, fieldTransforms);
  }
}

export class OfflinePatchWrite extends OfflineWriteMutation {
  readonly type = 'patch' as const;

  constructor(
    key: OracledbDocumentKey,
    readonly data: DocumentData,
    readonly fieldMask: Array<FieldPath | string>,
    precondition: OracledbWritePrecondition,
    fieldTransforms: OracledbFieldTransform[] = []
  ) {
    super(key, precondition, fieldTransforms);
  }
}

export class OfflineDeleteWrite extends OfflineWriteMutation {
  readonly type = 'delete' as const;

  constructor(
    key: OracledbDocumentKey,
    precondition: OracledbWritePrecondition,
    fieldTransforms: OracledbFieldTransform[] = []
  ) {
    super(key, precondition, fieldTransforms);
  }
}

export class OfflineTransformWrite extends OfflineWriteMutation {
  readonly type = 'transform' as const;

  constructor(
    key: OracledbDocumentKey,
    precondition: OracledbWritePrecondition,
    fieldTransforms: OracledbFieldTransform[] = []
  ) {
    super(key, precondition, fieldTransforms);
  }
}

export class OfflineWriteResult {
  constructor(
    readonly version: OracledbDocumentVersion,
    readonly transformResults: unknown[] = []
  ) {}
}

export type OfflineWriteBatchSource = 'individual' | 'writeBatch';

export class OfflineWriteBatch {
  constructor(
    readonly batchId: number,
    readonly localWriteTime: number,
    readonly mutations: OfflineWriteMutation[],
    readonly baseDocuments: Array<OfflineCachedDocument | null> = [],
    readonly userId: string = 'anonymous',
    readonly source: OfflineWriteBatchSource = mutations.length > 1 ? 'writeBatch' : 'individual'
  ) {}

  get affectedKeys(): OracledbDocumentKey[] {
    return this.mutations.map(mutation => mutation.key);
  }
}
