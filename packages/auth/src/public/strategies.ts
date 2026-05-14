import { User } from '../types/user.js';
import { UserCredential, AuthCredential } from '../internal/credential.js';
import { AuthProvider } from '../providers/provider.js';
import { PopupRedirectResolver, ApplicationVerifier } from '../types/auth.js';
import { Auth } from '../types/auth.js';
import { ActionCodeSettings } from '../types/action-code.js';
import { authErrorHandler,argCheck,typeStrings, AuthError, ErrorCodeMessage } from '../errors.js';
import { ConfirmationResult } from '../types/user.js';

/**
 * Loads the reCAPTCHA configuration into the Auth instance.
 *
 * @example
 * ```ts
 * import { getAuth, initializeRecaptchaConfig } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * await initializeRecaptchaConfig(auth);
 * ```
 */
/**
 * @internal
 */
export function initializeRecaptchaConfig(auth: Auth): Promise<void> {
  let error = new AuthError(ErrorCodeMessage.NOT_IMPLEMENT,"Not implemented");
  error.status = 501;
  throw authErrorHandler(error);
}

/**
 * Signs in using a Fusabase Custom Token.
 *
 * @example
 * ```ts
 * import { getAuth, signInWithCustomToken } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * const userCredential = await signInWithCustomToken(auth, customJwtToken);
 * ```
 */
/**
 * @internal
 */
export function signInWithCustomToken(
  auth: Auth,
  customToken: string
): Promise<UserCredential> {
  let error = new AuthError(ErrorCodeMessage.NOT_IMPLEMENT,"Not implemented");
  error.status = 501;
  throw authErrorHandler(error);
}

/**
 * Signs in a user with the given AuthCredential.
 *
 * @example
 * ```ts
 * import { getAuth, signInWithCredential, GoogleAuthProvider } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * const credential = GoogleAuthProvider.credential(idToken);
 * const userCredential = await signInWithCredential(auth, credential);
 * ```
 */
export function signInWithCredential(
  auth: Auth,
  credential: AuthCredential
): Promise<UserCredential> {
  return auth.signInWithCredential(credential);
}

/**
 * Signs in a user using an OAuth provider via a popup window.
 *
 * @example
 * ```ts
 * import { getAuth, signInWithPopup, GoogleAuthProvider } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * const provider = new GoogleAuthProvider();
 * const userCredential = await signInWithPopup(auth, provider);
 * ```
 */
export function signInWithPopup(
  auth: Auth,
  provider: AuthProvider,
  resolver?: PopupRedirectResolver
): Promise<UserCredential> {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return auth.signInWithPopup(provider);
}

/**
 * Signs in a user using an OAuth provider via full-page redirect.
 *
 * @example
 * ```ts
 * import { getAuth, signInWithRedirect, GoogleAuthProvider } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * const provider = new GoogleAuthProvider();
 * await signInWithRedirect(auth, provider);
 * ```
 */
export function signInWithRedirect(
  auth: Auth,
  provider: AuthProvider,
  resolver?: PopupRedirectResolver
):  Promise<never> {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, "Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return auth.signInWithRedirect(provider);
}

/**
 * Signs in using email and password.
 *
 * @example
 * ```ts
 * import { getAuth, signInWithEmailAndPassword } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * const userCredential = await signInWithEmailAndPassword(auth, 'user@example.com', 'password123');
 * ```
 */
export function signInWithEmailAndPassword(
  auth: Auth,
  email: string,
  password: string
): Promise<UserCredential> {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return auth.signInWithEmailAndPassword(email, password);
}

// /**
//  * Starts a phone number sign-in flow using reCAPTCHA.
//  *
//  * @example
//  * ```ts
//  * import { getAuth, signInWithPhoneNumber, RecaptchaVerifier } from 'fusabase/auth';
//  *
//  * const auth = getAuth();
//  * const verifier = new RecaptchaVerifier('recaptcha-container', {}, auth);
//  * const confirmationResult = await signInWithPhoneNumber(auth, '+15555550100', verifier);
//  * ```
//  */
// export function signInWithPhoneNumber(
//   auth: Auth,
//   phoneNumber: string,
//   appVerifier: ApplicationVerifier
// ): Promise<ConfirmationResult> {
//   let error = new AuthError(ErrorCodeMessage.NOT_IMPLEMENT,"Not implemented");
//   error.status = 501;
//   throw authErrorHandler(error);
// }

// /**
//  * Re-authenticates the user with a fresh AuthCredential.
//  *
//  * @example
//  * ```ts
//  * import { reauthenticateWithCredential, EmailAuthProvider } from 'fusabase/auth';
//  *
//  * const credential = EmailAuthProvider.credential(user.email!, 'password123');
//  * await reauthenticateWithCredential(user, credential);
//  * ```
//  */
// export function reauthenticateWithCredential(
//   user: User,
//   credential: AuthCredential
// ): Promise<UserCredential> {
//   let error = new AuthError(ErrorCodeMessage.NOT_IMPLEMENT,"Not implemented");
//   error.status = 501;
//   throw authErrorHandler(error);
// }

// /**
//  * Re-authenticates the current user with a provider using a popup flow.
//  *
//  * @example
//  * ```ts
//  * import { reauthenticateWithPopup, GoogleAuthProvider } from 'fusabase/auth';
//  *
//  * const provider = new GoogleAuthProvider();
//  * await reauthenticateWithPopup(user, provider);
//  * ```
//  */
// export function reauthenticateWithPopup(
//   user: User,
//   provider: AuthProvider,
//   resolver?: PopupRedirectResolver
// ): Promise<UserCredential> {
//   let error = new AuthError(ErrorCodeMessage.NOT_IMPLEMENT,"Not implemented");
//   error.status = 501;
//   throw authErrorHandler(error);
// }

// /**
//  * Re-authenticates the current user with a provider using a redirect flow.
//  *
//  * @example
//  * ```ts
//  * import { reauthenticateWithRedirect, GoogleAuthProvider } from 'fusabase/auth';
//  *
//  * const provider = new GoogleAuthProvider();
//  * await reauthenticateWithRedirect(user, provider);
//  * ```
//  */
// export function reauthenticateWithRedirect(
//   user: User,
//   provider: AuthProvider,
//   resolver?: PopupRedirectResolver
// ): Promise<never> {
//   let error = new AuthError(ErrorCodeMessage.NOT_IMPLEMENT,"Not implemented");
//   error.status = 501;
//   throw authErrorHandler(error);
// }

// /**
//  * Re-authenticates the current user with a phone credential.
//  *
//  * @example
//  * ```ts
//  * import { reauthenticateWithPhoneNumber, RecaptchaVerifier } from 'fusabase/auth';
//  *
//  * const verifier = new RecaptchaVerifier('recaptcha-container', {}, auth);
//  * const confirmationResult = await reauthenticateWithPhoneNumber(user, '+15555550100', verifier);
//  * ```
//  */
// export function reauthenticateWithPhoneNumber(
//   user: User,
//   phoneNumber: string,
//   appVerifier: ApplicationVerifier
// ): Promise<ConfirmationResult> {
//   let error = new AuthError(ErrorCodeMessage.NOT_IMPLEMENT,"Not implemented");
//   error.status = 501;
//   throw authErrorHandler(error);
// }


/**
 * Sets the provided user as the current user.
 *
 * @example
 * ```ts
 * import { updateCurrentUser } from 'fusabase/auth';
 *
 * await updateCurrentUser(auth, user);
 * ```
 */
export async function updateCurrentUser(
  auth: Auth,
  user: User | null
): Promise<void> {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    await auth.updateCurrentUser(user);
}

/**
 * Signs out the current user.
 *
 * @example
 * ```ts
 * import { getAuth, signOut } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * await signOut(auth);
 * ```
 */
export function signOut(auth: Auth): Promise<void> {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return auth.signOut();
}
