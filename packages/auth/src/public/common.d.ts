import { Auth } from "../types/auth.js";
import { User } from "../types/user.js";
import {ActionCodeInfo} from '../types/action-code.js';

export function onAuthStateChanged(
  auth: Auth,
  nextOrObserver: ((user: User | null) => void),
  error?: (error: Error) => void,
  completed?: () => void
): () => void;


// /**
//  * Applies a verification code sent to the user via email for actions like
//  * email verification or password reset.
//  *
//  * Common use cases:
//  * - Confirming a user's email address.
//  * - Reverting a password reset (if supported).
//  *
//  * Example:
//  * ```ts
//  * import { applyActionCode, getAuth } from 'fusabase/auth';
//  *
//  * const auth = getAuth();
//  * await applyActionCode(auth, actionCode);
//  * ```
//  *
//  * @param auth - The Auth instance to use.
//  * @param oobCode - The out-of-band (OOB) code from the email action link.
//  *
//  * @returns A promise that resolves when the action has been applied successfully.
//  *          Rejects with an error if the code is invalid, expired, or already used.
//  */
// export declare function applyActionCode(
//   auth: Auth,
//   oobCode: string
// ): Promise<void>;


// /**
//  * Checks the validity of an out-of-band action code.
//  *
//  * Typically used for password reset, email verification, or recovering a disabled account.
//  *
//  * @param auth - The Auth instance.
//  * @param oobCode - The action code from the email link.
//  * @returns A promise resolving with ActionCodeInfo if the code is valid.
//  */
// export declare function checkActionCode(
//   auth: Auth,
//   oobCode: string
// ): Promise<ActionCodeInfo>;