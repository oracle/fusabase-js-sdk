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

// Update the import statement to the correct path for IdToken
import { IdTokenResult } from "../../types/idtoken.js";

// Rest of the file remains the same
import InMemoryPersistence from "../storage/InMemoryPersistence.js";
import BrowserLocalPersistence from "../storage/BrowserLocalPersistence.js";
import BrowserSessionPersistence from "../storage/BrowserSessionPersistence.js";
import PersistenceType from "./PersistenceType.js";

/**
 * @internal
 */
class PersistenceUserManager {
  persistence: any = null;
  private persistenceListener: any = null;
  private token_key: string;

  constructor(listener: any, name: string) {
    this.token_key = name;
    this.persistence = new BrowserLocalPersistence();
    if (!this.persistence._isAvailable()) {
      this.persistence = new BrowserSessionPersistence();
      if (!this.persistence._isAvailable()) {
        this.persistence = new InMemoryPersistence();
      }
    }
    this.persistenceListener = listener;
  }

  private tokensParse(tokens: any): any {
    tokens = JSON.parse(tokens);
    tokens.access_token = JSON.parse(tokens.access_token);
    return tokens;
  }

  private tokensStringify(tokens: any): string {
    tokens.access_token = tokens.access_token.stringify();
    tokens = JSON.stringify(tokens);
    return tokens;
  }

  async setPersistence(persistence: PersistenceType): Promise<void> {
    let token_stringify: string | null = null;
    if (persistence === this.persistence.type) {
      return;
    }
    let tokens: any = await this.persistence._get(this.token_key);

    if (tokens) {
      await this.persistence._remove(this.token_key);
      tokens = this.tokensParse(tokens);
      const temp_access_token = new IdTokenResult(tokens.access_token.token);
      tokens.access_token = temp_access_token;

      token_stringify = this.tokensStringify(tokens);
    }

    if (persistence === PersistenceType.LOCAL) {
      this.persistence = new BrowserLocalPersistence();
    } else if (persistence === PersistenceType.SESSION) {
      this.persistence = new BrowserSessionPersistence();
    } else {
      this.persistence = new InMemoryPersistence();
    }

    if (tokens) {
      await this.persistence._set(this.token_key, tokens);
      this.persistenceListener.postMessage({
        name: persistence === PersistenceType.LOCAL ? "login_local" : "login_session_none",
        tokens: token_stringify,
      });
    }
  }
}

export default PersistenceUserManager;
