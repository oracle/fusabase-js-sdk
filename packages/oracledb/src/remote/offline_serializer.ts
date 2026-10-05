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

import { OfflineWriteMutation } from '../model/index.js';

export type OfflineWriteRequest =
  | { operation: 'set'; merge: boolean; mergeFields: string[] }
  | { operation: 'update' }
  | { operation: 'delete' };

export class OfflineOracledbSerializer {
  toWriteRequest(mutation: OfflineWriteMutation): OfflineWriteRequest {
    switch (mutation.type) {
      case 'set':
        return { operation: 'set', merge: false, mergeFields: [] };
      case 'patch':
        return {
          operation: mutation.precondition.exists === true ? 'update' : 'set',
          merge: true,
          mergeFields: (mutation as any).fieldMask?.map((field: any) => String(field)) ?? [],
        };
      case 'delete':
        return { operation: 'delete' };
      default:
        throw new Error(`Unsupported offline mutation type ${mutation.type}`);
    }
  }
}
