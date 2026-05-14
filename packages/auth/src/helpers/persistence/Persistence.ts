import PersistenceType from "./PersistenceType.js";

/**
 * @internal
 */
const AuthPersistence = {
    LOCAL: { type: PersistenceType.LOCAL },
    SESSION: { type: PersistenceType.SESSION },
    NONE: { type: PersistenceType.NONE }
}

export default AuthPersistence;