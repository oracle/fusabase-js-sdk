import PersistenceType from "../helpers/persistence/PersistenceType.js";

/**
 * Interface for persistence mechanisms used to store authentication state.
 */
export interface Persistence {
  /** The type identifier for this persistence mechanism (e.g., "LOCAL", "SESSION", "NONE") */
  readonly type: string;
}

/**
 * Persistence implementation using browser local storage.
 * Data persists across browser sessions and tabs.
 *
 * @example
 * ```ts
 * import { browserLocalPersistence } from './persistence.js';
 * const auth = initializeAuth(app, { persistence: browserLocalPersistence });
 * ```
 */
export const browserLocalPersistence: Persistence = {
  type: PersistenceType.LOCAL
}

/**
 * Persistence implementation using browser session storage.
 * Data persists only for the current browser tab/session.
 *
 * @example
 * ```ts
 * import { browserSessionPersistence } from './persistence.js';
 * const auth = initializeAuth(app, { persistence: browserSessionPersistence });
 * ```
 */
export const browserSessionPersistence: Persistence = {
  type: PersistenceType.SESSION
}

/**
 * Persistence implementation that stores data only in memory.
 * Data is lost when the page is refreshed or navigated away from.
 *
 * @example
 * ```ts
 * import { inMemoryPersistence } from './persistence.js';
 * const auth = initializeAuth(app, { persistence: inMemoryPersistence });
 * ```
 */
export const inMemoryPersistence: Persistence = {
  type: PersistenceType.NONE
}
