import { Auth } from '../types/auth.js';
import { ActionCodeSettings } from '../types/action-code.js';
import { authErrorHandler,argCheck,typeStrings, AuthError, ErrorCodeMessage } from '../errors.js';

/**
 * Sends a password reset email to the given email address.
 *
 * @param auth - The Auth instance.
 * @param email - The email to which the reset link should be sent.
 * @param actionCodeSettings - Optional action code settings.
 * @returns A promise that resolves when the email has been sent.
 */
export function sendPasswordResetEmail(
  auth: Auth,
  email: string,
  actionCodeSettings?: ActionCodeSettings
): Promise<void> {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return auth.sendPasswordResetEmail(email, actionCodeSettings);
}


/**
 * Verifies a password reset code sent via email.
 *
 * @param auth - The Auth instance.
 * @param code - The password reset code.
 * @returns A promise resolving with the email address associated with the code.
 */
export function verifyPasswordResetCode(
  auth: Auth,
  code: string
): Promise<string> {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return auth.verifyPasswordResetCode(code);
}


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
export function confirmPasswordReset(
  auth: Auth,
  code: string,
  newPassword: string
): Promise<void> {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return auth.confirmPasswordReset(code, newPassword);
}
