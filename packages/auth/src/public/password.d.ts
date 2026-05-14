import { Auth } from '../types/auth.js';
import { ActionCodeSettings } from '../types/action-code.js';

/**
 * Sends a password reset email to the given email address.
 *
 * @param auth - The Auth instance.
 * @param email - The email to which the reset link should be sent.
 * @param actionCodeSettings - Optional action code settings.
 * @returns A promise that resolves when the email has been sent.
 */
export declare function sendPasswordResetEmail(
  auth: Auth,
  email: string,
  actionCodeSettings?: ActionCodeSettings
): Promise<void>;


/**
 * Verifies a password reset code sent via email.
 *
 * @param auth - The Auth instance.
 * @param code - The password reset code.
 * @returns A promise resolving with the email address associated with the code.
 */
export declare function verifyPasswordResetCode(
  auth: Auth,
  code: string
): Promise<string>;


/**
 * Completes the password reset process by verifying the reset code and
 * updating the user's password.
 *
 * Example:
 * ```ts
 * import { confirmPasswordReset, getAuth } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * await confirmPasswordReset(auth, actionCode, newPassword);
 * ```
 *
 * @param auth - The Auth instance.
 * @param oobCode - The out-of-band code from the password reset email link.
 * @param newPassword - The user's new password.
 *
 * @returns A promise that resolves when the password has been reset.
 *          Rejects with an error if the code is invalid or expired.
 */
export declare function confirmPasswordReset(
  auth: Auth,
  oobCode: string,
  newPassword: string
): Promise<void>;
