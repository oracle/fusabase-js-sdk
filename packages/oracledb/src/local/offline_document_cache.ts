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

import { OfflineCachedDocument, OfflineDocumentCacheContract, OfflinePersistence } from './types.js';
import { OracledbDocumentKey } from '../model/index.js';

export class OfflineDocumentCache implements OfflineDocumentCacheContract {
  constructor(private readonly persistence: OfflinePersistence) {}

  async getDocument(key: OracledbDocumentKey): Promise<OfflineCachedDocument | null> {
    return this.persistence.documents.get(key.path) ?? null;
  }

  async getDocumentsMatchingPrefix(pathPrefix: string): Promise<OfflineCachedDocument[]> {
    const normalizedPrefix = pathPrefix.split('/').filter(Boolean).join('/');
    const expectedDepth = normalizedPrefix ? normalizedPrefix.split('/').length + 1 : 1;
    const docs: OfflineCachedDocument[] = [];
    for (const [path, document] of this.persistence.documents.entries()) {
      const segments = path.split('/').filter(Boolean);
      const matchesPrefix = !normalizedPrefix || path.startsWith(`${normalizedPrefix}/`);
      if (matchesPrefix && segments.length === expectedDepth) {
        docs.push(document);
      }
    }
    return docs;
  }

  async setDocument(document: OfflineCachedDocument): Promise<void> {
    if (this.persistence.setDocument) {
      await this.persistence.setDocument(document);
      return;
    }
    this.persistence.documents.set(document.key.path, document);
  }

  async removeDocument(key: OracledbDocumentKey): Promise<void> {
    if (this.persistence.removeDocument) {
      await this.persistence.removeDocument(key);
      return;
    }
    this.persistence.documents.delete(key.path);
  }
}
