import PersistenceType from '../persistence/PersistenceType.js';
import { safeStringify } from '../../util/util.js';

/**
 * @internal
 */
class InMemoryPersistence {
    type = PersistenceType.NONE;
    private storage: any = {};
    storagekey = "__ORACLE";

    _isAvailable(): boolean {
        try {
            this.storage[this.storagekey] = '1';
            delete this.storage[this.storagekey];
            return true;
        } catch (err) {
            return false;
        }
    }

    async _set(key: string, value: any): Promise<boolean> {
      try {
        if (value.access_token && typeof value.access_token === 'object') {
          value.access_token = safeStringify(value.access_token);
        }
        this.storage[key] = JSON.stringify(value);
        return true;
      } catch (err) {
        throw err;
      }
    }

    async _get(key: string): Promise<any> {
      try {
        const value = this.storage[key];
        return value ? JSON.parse(value) : null;
      } catch (err) {
        throw err;
      }
    }

    async _remove(key: string): Promise<boolean> {
      try {
        delete this.storage[key];
        return true;
      } catch (err) {
        throw err;
      }
    }
}

export default InMemoryPersistence;
