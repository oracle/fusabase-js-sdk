import PersistenceType from '../persistence/PersistenceType.js';
import { safeStringify } from '../../util/util.js';

/**
 * @internal
 */
class BrowserSessionPersistence {
    type = PersistenceType.SESSION;
    storagekey = "__ORACLE";
    private storage: any;

    constructor() {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        this.storage = window.sessionStorage;
      } else {
        throw new Error('sessionStorage is not available');
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

export default BrowserSessionPersistence;
