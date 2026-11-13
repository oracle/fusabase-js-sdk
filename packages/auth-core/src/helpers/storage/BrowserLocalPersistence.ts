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

import PersistenceType from '../persistence/PersistenceType.js';
import { safeStringify } from '../../util/util.js';

/**
 * @internal
 */
class BrowserLocalPersistence {
    type = PersistenceType.LOCAL;
    storagekey = "__ORACLE";
    private storage: any;

    constructor() {
      if (typeof window !== 'undefined' && window.localStorage) {
        this.storage = window.localStorage;
      } else {
        throw new Error('localStorage is not available');
      }
    }

    _isAvailable(): boolean {
        try {
            this.storage.setItem(this.storagekey, '1');
            this.storage.removeItem(this.storagekey);
            return true;
        } catch (err) {
            return false;
        }
    }

    async _set(key: string, value: any): Promise<boolean> {
      if (value.access_token && typeof value.access_token === 'object') {
        value.access_token = safeStringify(value.access_token);
      }
      try {
        this.storage.setItem(key, JSON.stringify(value));
        return true;
      } catch (err) {
        throw err;
      }
    }

    async _get(key: string): Promise<any> {
      try {
        const value = this.storage.getItem(key);
        return value ? JSON.parse(value) : null;
      } catch (err) {
        throw err;
      }
    }

    async _remove(key: string): Promise<boolean> {
      try {
        this.storage.removeItem(key);
        return true;
      } catch (err) {
        throw err;
      }
    }
}

export default BrowserLocalPersistence;
