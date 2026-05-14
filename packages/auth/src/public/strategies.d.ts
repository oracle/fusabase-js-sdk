
import { User } from '../types/user.js';
import { UserCredential, AuthCredential } from '../internal/credential.js';
import { AuthProvider } from '../providers/provider.js';
import { PopupRedirectResolver, ApplicationVerifier } from '../types/auth.js';
import { Auth } from '../types/auth.js';
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
export declare function initializeRecaptchaConfig(auth: Auth): Promise<void>;

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
export declare function signInWithCustomToken(
  auth: Auth,
  customToken: string
): Promise<UserCredential>;

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
export declare function signInWithCredential(
  auth: Auth,
  credential: AuthCredential
): Promise<UserCredential>;

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
export declare function signInWithPopup(
  auth: Auth,
  provider: AuthProvider,
  resolver?: PopupRedirectResolver
): Promise<UserCredential>;

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
export declare function signInWithRedirect(
  auth: Auth,
  provider: AuthProvider,
  resolver?: PopupRedirectResolver
): Promise<never>;

/**
 * Signs in a user anonymously.
 *
 * @example
 * ```ts
 * import { getAuth, signInAnonymously } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * const userCredential = await signInAnonymously(auth);
 * ```
 */
export declare function signInAnonymously(auth: Auth): Promise<UserCredential>;

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
export declare function signInWithEmailAndPassword(
  auth: Auth,
  email: string,
  password: string
): Promise<UserCredential>;

/**
 * Checks if a link is a sign-in with email link.
 *
 * @example
 * ```ts
 * import { getAuth, isSignInWithEmailLink } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * if (isSignInWithEmailLink(auth, window.location.href)) {
 *   console.log('This is a valid sign-in link.');
 * }
 * ```
 */
export declare function isSignInWithEmailLink(
  auth: Auth,
  emailLink: string
): boolean;

/**
 * Starts a phone number sign-in flow using reCAPTCHA.
 *
 * @example
 * ```ts
 * import { getAuth, signInWithPhoneNumber, RecaptchaVerifier } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * const verifier = new RecaptchaVerifier('recaptcha-container', {}, auth);
 * const confirmationResult = await signInWithPhoneNumber(auth, '+15555550100', verifier);
 * ```
 */
export declare function signInWithPhoneNumber(
  auth: Auth,
  phoneNumber: string,
  appVerifier: ApplicationVerifier
): Promise<ConfirmationResult>;

/**
 * Re-authenticates the user with a fresh AuthCredential.
 *
 * @example
 * ```ts
 * import { reauthenticateWithCredential, EmailAuthProvider } from 'fusabase/auth';
 *
 * const credential = EmailAuthProvider.credential(user.email!, 'password123');
 * await reauthenticateWithCredential(user, credential);
 * ```
 */
export declare function reauthenticateWithCredential(
  user: User,
  credential: AuthCredential
): Promise<UserCredential>;

/**
 * Re-authenticates the current user with a provider using a popup flow.
 *
 * @example
 * ```ts
 * import { reauthenticateWithPopup, GoogleAuthProvider } from 'fusabase/auth';
 *
 * const provider = new GoogleAuthProvider();
 * await reauthenticateWithPopup(user, provider);
 * ```
 */
export declare function reauthenticateWithPopup(
  user: User,
  provider: AuthProvider,
  resolver?: PopupRedirectResolver
): Promise<UserCredential>;

/**
 * Re-authenticates the current user with a provider using a redirect flow.
 *
 * @example
 * ```ts
 * import { reauthenticateWithRedirect, GoogleAuthProvider } from 'fusabase/auth';
 *
 * const provider = new GoogleAuthProvider();
 * await reauthenticateWithRedirect(user, provider);
 * ```
 */
export declare function reauthenticateWithRedirect(
  user: User,
  provider: AuthProvider,
  resolver?: PopupRedirectResolver
): Promise<never>;

/**
 * Re-authenticates the current user with a phone credential.
 *
 * @example
 * ```ts
 * import { reauthenticateWithPhoneNumber, RecaptchaVerifier } from 'fusabase/auth';
 *
 * const verifier = new RecaptchaVerifier('recaptcha-container', {}, auth);
 * const confirmationResult = await reauthenticateWithPhoneNumber(user, '+15555550100', verifier);
 * ```
 */
export declare function reauthenticateWithPhoneNumber(
  user: User,
  phoneNumber: string,
  appVerifier: ApplicationVerifier
): Promise<ConfirmationResult>;


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
export declare function updateCurrentUser(
  auth: Auth,
  user: User | null
): Promise<void>;

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
export declare function signOut(auth: Auth): Promise<void>;
