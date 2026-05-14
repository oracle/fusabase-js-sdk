import { Auth } from '../types/auth.js';
import { User } from '../types/user.js';
import { authErrorHandler, AuthError, ErrorCodeMessage } from '../errors.js';

/**
 * Adds an observer for changes to the user's ID token.
 *
 * This listener is triggered when the user's ID token changes, such as when
 * the token is refreshed or when the user signs in/out.
 *
 * @param auth - The Auth instance.
 * @param nextOrObserver - A function called when the ID token changes, receiving the current user or null.
 * @param error - Optional error callback (currently not implemented).
 * @param completed - Optional completion callback (currently not implemented).
 * @returns An unsubscribe function to remove the listener.
 *
 * @example
 * ```ts
 * import { onIdTokenChanged, getAuth } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * const unsubscribe = onIdTokenChanged(auth, (user) => {
 *   if (user) {
 *     console.log('User is signed in:', user.uid);
 *     // Get the ID token
 *     user.getIdToken().then((idToken) => {
 *       console.log('ID Token:', idToken);
 *     });
 *   } else {
 *     console.log('User is signed out');
 *   }
 * });
 *
 * // Later, to remove the listener:
 * unsubscribe();
 * ```
 */
export function onIdTokenChanged(
  auth: Auth,
  nextOrObserver: ((user: User | null) => void),
  error?: (error: Error) => void,
  completed?: () => void
): () => void {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, "Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return auth.onIdTokenChanged(nextOrObserver);
}

/**
 * Revokes an OAuth access token (Apple only).
 *
 * @example
 * ```ts
 * import { revokeAccessToken } from 'fusabase/auth';
 *
 * await revokeAccessToken(auth, appleAccessToken);
 * ```
 */
export declare function revokeAccessToken(
  auth: Auth,
  token: string
): Promise<void>;
