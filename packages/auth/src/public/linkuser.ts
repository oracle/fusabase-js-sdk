import { ConfirmationResult, User } from '../types/user.js';
import { UserCredential, AuthCredential } from '../internal/credential.js';
import { AuthProvider } from '../providers/provider.js';
import { PopupRedirectResolver, ApplicationVerifier } from '../types/auth.js';

// /**
//  * Links the user account with the given credential.
//  *
//  * @example
//  * ```ts
//  * import { linkWithCredential, EmailAuthProvider } from 'fusabase/auth';
//  * const credential = EmailAuthProvider.credential(user.email!, 'password123');
//  * const result = await linkWithCredential(user, credential);
//  * ```
//  */
// export declare function linkWithCredential(
//   user: User,
//   credential: AuthCredential
// ): Promise<UserCredential>;

// /**
//  * Links the user account with the given phone number.
//  *
//  * @example
//  * ```ts
//  * import { linkWithPhoneNumber, RecaptchaVerifier } from 'fusabase/auth';
//  * const verifier = new RecaptchaVerifier('recaptcha-container', {}, auth);
//  * const confirmationResult = await linkWithPhoneNumber(user, '+15555550100', verifier);
//  * ```
//  */
// export declare function linkWithPhoneNumber(
//   user: User,
//   phoneNumber: string,
//   appVerifier: ApplicationVerifier
// ): Promise<ConfirmationResult>;

// /**
//  * Links the authenticated provider using a popup-based OAuth flow.
//  *
//  * @example
//  * ```ts
//  * import { linkWithPopup, GoogleAuthProvider } from 'fusabase/auth';
//  * const provider = new GoogleAuthProvider();
//  * const result = await linkWithPopup(user, provider);
//  * ```
//  */
// export declare function linkWithPopup(
//   user: User,
//   provider: AuthProvider,
//   resolver?: PopupRedirectResolver
// ): Promise<UserCredential>;

// /**
//  * Links the OAuth provider using a full-page redirect flow.
//  *
//  * @example
//  * ```ts
//  * import { linkWithRedirect, GoogleAuthProvider } from 'fusabase/auth';
//  * const provider = new GoogleAuthProvider();
//  * await linkWithRedirect(user, provider);
//  * ```
//  */
// export declare function linkWithRedirect(
//   user: User,
//   provider: AuthProvider,
//   resolver?: PopupRedirectResolver
// ): Promise<never>;

// /**
//  * Unlinks a provider from a user account.
//  *
//  * @example
//  * ```ts
//  * import { unlink } from 'fusabase/auth';
//  * const updatedUser = await unlink(user, 'google.com');
//  * ```
//  */
// export declare function unlink(
//   user: User,
//   providerId: string
// ): Promise<User>;