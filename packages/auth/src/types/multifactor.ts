import { UserCredential } from "../internal/credential.js";
/**
 * Represents a second-factor assertion for MFA.
 *
 * @example
 * ```ts
 * import { MultiFactorAssertion } from './type/multi-factor.js';
 * function submitAssertion(assertion: MultiFactorAssertion) {
 *   console.log(assertion.toJSON());
 * }
 * ```
 */
export interface MultiFactorAssertion {
  /** Serialize to JSON */
  toJSON(): object;
}

/**
 * Information about a second factor enrolled for a user.
 */
export interface MultiFactorInfo {
  uid: string;
  displayName?: string | null;
  factorId: string;
}

/**
 * MFA errors thrown during sign-in.
 */
export interface MultiFactorError extends Error {
  resolver?: MultiFactorResolver;
}

/**
 * Resolver to handle MFA sign-in.
 */
export interface MultiFactorResolver {
  hints: MultiFactorInfo[];
  resolveSignIn(assertion: MultiFactorAssertion): Promise<UserCredential>;
}

/**
 * Represents a user's multi-factor session.
 */
export interface MultiFactorSession {}
