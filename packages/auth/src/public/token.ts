import { UserCredential } from '../internal/credential.js';
import { PopupRedirectResolver } from '../types/auth.js';
import { Auth } from '../types/auth.js';
import { AuthError, authErrorHandler, ErrorCodeMessage } from '../errors.js';

/**
 * Returns the result of a redirect-based sign-in flow.
 *
 * @param auth - The Auth instance.
 * @param resolver - Optional popup/redirect resolver.
 * @returns A promise resolving with the UserCredential if available, or null.
 */
export function getRedirectResult(
  auth: Auth,
  resolver?: PopupRedirectResolver
): Promise<UserCredential | null> {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
  return auth.getRedirectResult();
}




