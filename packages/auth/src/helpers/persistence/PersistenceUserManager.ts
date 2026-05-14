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
