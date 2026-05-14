import { App } from '../../../app/src/public-types.js';
import { Auth } from '../types/auth.js';
import { PopupRedirectResolver, Dependencies } from '../types/auth.js';
import { User } from '../types/user.js';
import { Unsubscribe } from '../types/auth.js';
import { Persistence } from '../types/persistence.js';
import { PasswordValidationStatus, PasswordPolicy } from '../types/password.js'
import { authErrorHandler,argCheck,typeStrings, AuthError, ErrorCodeMessage } from '../errors.js';
import fusabase from '../../../app/src/fusabase-internal.js';

/**
 * Returns the Auth instance for the given App.
 * If no app is provided, uses the default App.
 *
 * @param app - The App instance (optional).
 * @returns The Auth instance tied to the provided or default app.
 */
export function getAuth(app?: App): Auth {
  app = app == null ? fusabase.app() : app;
    if (!(app instanceof App)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid app instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return fusabase.auth(app) as any;
}


/**
 * Initializes an Auth instance for the given App with explicit dependencies.
 *
 * This should be used instead of `getAuth` if you need to control which persistence
 * or popup/redirect resolver is used. Only one Auth instance can be initialized per
 * app; subsequent calls will throw an error.
 *
 * @param app - The App instance.
 * @param deps - Optional dependencies such as persistence or popup/redirect resolvers.
 * @returns The initialized Auth instance for the given app.
 */
export function initializeAuth(
  app: App,
  deps?: Dependencies
): Auth {
  if (!(app instanceof App)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid app instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    argCheck(deps, "Invalid settings object", false, [typeStrings.OBJECT]);
    var pers_arr: string[] = [];
    if (deps?.persistence) {
        if (Array.isArray(deps.persistence)) {
          for (let i = 0; i < deps.persistence.length; i++) {
              pers_arr.push(deps.persistence[i].type);
          }
        } else {
            pers_arr.push(deps.persistence.type);
        }
    }
    var available_pers = ['LOCAL', 'SESSION', 'NONE'];

    for (let i = 0; i < 3; i++) {
        if (!pers_arr.includes(available_pers[i])) {
            pers_arr.push(available_pers[i]);
        }
    }

    return fusabase.auth(app) as any;
}


/**
 * Adds a blocking callback that runs before an auth state change sets a new user.
 *
 * This can be used to delay the resolution of the new auth state until the
 * callback completes (e.g., awaiting async initialization).
 *
 * Example:
 * ```ts
 * import { beforeAuthStateChanged, getAuth } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * const unsubscribe = beforeAuthStateChanged(auth, async (user) => {
 *   if (user) {
 *     // Perform setup before the new user is fully set
 *     await loadUserProfile(user.uid);
 *   }
 * });
 *
 * // Later, to remove the listener:
 * unsubscribe();
 * ```
 *
 * @param auth - The Auth instance.
 * @param callback - A function invoked before a new `User` is set. May return
 *                   a promise to perform async work.
 * @param onAbort - Optional function that is called if the listener is aborted.
 *
 * @returns An unsubscribe function to remove the callback.
 */
export function beforeAuthStateChanged(
  auth: Auth,
  callback: (user: User | null) => void | Promise<void>,
  onAbort?: () => void
): Unsubscribe {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return auth.beforeAuthStateChanged(callback, onAbort);
}


/**
 * Changes the type of persistence on the Auth instance for the currently saved session.
 *
 * @example
 * ```ts
 * import { getAuth, setPersistence, browserLocalPersistence } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * await setPersistence(auth, browserLocalPersistence);
 * ```
 *
 * @param auth - The Auth instance.
 * @param persistence - The persistence implementation (LOCAL, SESSION, or NONE).
 */
export function setPersistence(
  auth: Auth,
  persistence: Persistence
): Promise<void> {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, "Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return auth.setPersistence(persistence);
}

/**
 * Validates the password against the password policy configured for the project or tenant.
 *
 * @example
 * ```ts
 * import { getAuth, validatePassword } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * const validation = await validatePassword(auth, 'MyStrongPass123!');
 * if (validation.valid) {
 *   console.log('Password is valid!');
 * } else {
 *   console.log('Password failed requirements:', validation);
 * }
 * ```
 *
 * @param auth - The Auth instance.
 * @param password - The password to validate.
 * @returns A promise resolving to a PasswordValidationStatus object.
 */
export function validatePassword(
  auth: Auth,
  password: string
): Promise<PasswordValidationStatus> {
  // Basic password validation policy
  const policy: PasswordPolicy = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  };

  const errors: string[] = [];

  if (policy.minLength && password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\]{};':"\\|,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  const valid = errors.length === 0;
  const result: PasswordValidationStatus = { valid, errors };

  return Promise.resolve(result);
}
