import { Auth } from "../types/auth.js";
import { UserCredential } from "../internal/credential.js";
import { ActionCodeSettings } from "../types/action-code.js";

/**
 * Creates a new user with the provided email and password.
 *
 * @param auth - The Auth instance.
 * @param email - The user's email.
 * @param password - The user's password.
 * @returns A promise resolving with a UserCredential on success.
 */
export declare function createUserWithEmailAndPassword(
  auth: Auth,
  email: string,
  password: string
): Promise<UserCredential>;


// /**
//  * Fetches the list of sign-in methods for a given email address.
//  *
//  * @param auth - The Auth instance.
//  * @param email - The email address.
//  * @returns A promise resolving with an array of sign-in methods (strings).
//  */
// export declare function fetchSignInMethodsForEmail(
//   auth: Auth,
//   email: string
// ): Promise<string[]>;


// /**
//  * Checks if a link is a sign-in with email link.
//  *
//  * @param auth - The Auth instance.
//  * @param emailLink - The link to check.
//  * @returns True if the link is a sign-in with email link.
//  */
// export declare function isSignInWithEmailLink(
//   auth: Auth,
//   emailLink: string
// ): boolean;



// /**
//  * Sends a sign-in email link to the provided email address.
//  *
//  * @param auth - The Auth instance.
//  * @param email - The email to which the link should be sent.
//  * @param actionCodeSettings - The action code settings.
//  * @returns A promise that resolves when the link has been sent.
//  */
// export declare function sendSignInLinkToEmail(
//   auth: Auth,
//   email: string,
//   actionCodeSettings: ActionCodeSettings
// ): Promise<void>;


