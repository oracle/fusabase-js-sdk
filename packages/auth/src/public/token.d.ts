import { UserCredential } from '../internal/credential.js';
import { PopupRedirectResolver} from '../types/auth.js';
import { Auth } from '../types/auth.js';

/**
 * Returns the result of a redirect-based sign-in flow.
 *
 * @param auth - The Auth instance.
 * @param resolver - Optional popup/redirect resolver.
 * @returns A promise resolving with the UserCredential if available, or null.
 */
export declare function getRedirectResult(
  auth: Auth,
  resolver?: PopupRedirectResolver
): Promise<UserCredential | null>;




