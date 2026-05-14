import { User } from '../types/user.js';
import { AuthCredential, UserCredential } from '../internal/credential.js';
import { ActionCodeSettings } from '../types/action-code.js';
import { authErrorHandler,argCheck,typeStrings, AuthError, ErrorCodeMessage } from '../errors.js';
import { PopupRedirectResolver } from '../types/auth.js';
import { AuthProvider } from '../providers/provider.js';
// import { MultiFactorUser } from './user.js';


/**
 * Returns a JSON Web Token (JWT) for the user.
 *
 * @example
 * ```ts
 * import { getIdToken } from 'fusabase/auth';
 * const token = await getIdToken(user, true);
 * ```
 */
export async function getIdToken(user: User, forceRefresh?: boolean): Promise<string> {
  if (!(user instanceof User)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid user instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    let token = await user.getIdToken(forceRefresh);
    return token ?? "";
}

/**
 * Returns a deserialized ID token with claims and metadata.
 *
 * @example
 * ```ts
 * import { getIdTokenResult } from 'fusabase/auth';
 * const tokenResult = await getIdTokenResult(user, true);
 * console.log(tokenResult.claims);
 * ```
 */
export function getIdTokenResult(user: User, forceRefresh?: boolean): Promise<any> {
  if (!(user instanceof User)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid user instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return user.getIdTokenResult(forceRefresh);
}

// /**
//  * Returns the MultiFactorUser corresponding to the user.
//  *
//  * @example
//  * ```ts
//  * import { multiFactor } from 'fusabase/auth';
//  * const mfaUser = multiFactor(user);
//  * ```
//  */
// export function multiFactor(user: User): MultiFactorUser;

/**
 * Reloads the user account data.
 *
 * @example
 * ```ts
 * import { reload } from 'fusabase/auth';
 * await reload(user);
 * ```
 */
export function reload(user: User): Promise<void> {
  if (!(user instanceof User)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid user instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return user.reload();
}

/**
 * Sends a verification email to the user.
 *
 * @example
 * ```ts
 * import { sendEmailVerification } from 'fusabase/auth';
 * await sendEmailVerification(user, { url: 'https://example.com/finishSignUp' });
 * ```
 */
export function sendEmailVerification(
  user: User,
  actionCodeSettings?: ActionCodeSettings
): Promise<void> {
  if (!(user instanceof User)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid user instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return user.sendEmailVerification(actionCodeSettings);
}


/**
 * Updates the user's password.
 *
 * @example
 * ```ts
 * import { updatePassword } from 'fusabase/auth';
 * await updatePassword(user, 'NewStrongPass123!');
 * ```
 */
export function updatePassword(
  user: User,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  if (!(user instanceof User)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid user instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return user.updatePassword(oldPassword, newPassword);
}

/**
 * Updates the user's profile data (displayName and photoURL).
 *
 * @example
 * ```ts
 * import { updateProfile } from 'fusabase/auth';
 * await updateProfile(user, { displayName: 'John Doe', photoURL: 'https://example.com/photo.jpg' });
 * ```
 */
export function updateProfile(
  user: User,
  profile: { displayName?: string; photoURL?: string }
): Promise<void> {
  if (!(user instanceof User)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid user instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return user.updateProfile(profile);
}

/**
 * Links the provided credential to the current user account.
 * @async
 * @param {AuthCredential} credential - The auth credential to link with.
 * @returns {Promise<UserCredential>} A promise that resolves with the user credential.
 */
export function linkWithCredential(user: User, credential: AuthCredential): Promise<UserCredential> {
    return user.linkWithCredential(credential);
}

/**
 * Links the user account with the given provider using a redirect.
 * @async
 * @param {Object} provider - The auth provider instance (e.g., GoogleAuthProvider).
 * @returns {Promise<void>}
 */
export function linkWithRedirect(user: User, provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<never> {
    return user.linkWithRedirect(provider);
}

/**
 * Links the user account with the given provider using a popup window.
 * @async
 * @param {Object} provider - The auth provider instance (e.g., GoogleAuthProvider).
 * @returns {Promise<UserCredential>} A promise that resolves with the user credential or null.
 */
export function linkWithPopup(user: User, provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<UserCredential> {
    return user.linkWithPopup(provider);
}

/**
 * Unlinks a provider from the user's account.
 * @async
 * @param {string} providerId - The ID of the provider to unlink.
 * @returns {Promise<User>} The updated user object.
 */
export function unlink(user: User, providerId: string): Promise<User> {
    return user.unlink(providerId);
}