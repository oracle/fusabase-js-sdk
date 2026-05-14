/**
 * Represents a response from an email action code operation.
 *
 * @example
 * ```ts
 * import { ActionCodeInfo } from './type/action-code.js';
 * const info: ActionCodeInfo = { operation: 'PASSWORD_RESET', email: 'user@example.com' };
 * console.log(info.operation); // PASSWORD_RESET
 * ```
 */
export interface ActionCodeInfo {
  /** The type of action the code represents, e.g., PASSWORD_RESET */
  operation: string;
  /** The email for which the action code applies */
  email?: string;
  /** The previous email, if applicable (for email change) */
  previousEmail?: string;
}

/**
 * Settings for handling email action links, including continue URL and optional platform identifiers.
 *
 * @example
 * ```ts
 * import { ActionCodeSettings } from './type/action-code.js';
 * const settings: ActionCodeSettings = {
 *   url: 'https://example.com/finishSignUp',
 *   handleCodeInApp: true,
 *   iOS: { bundleId: 'com.example.ios' },
 *   android: { packageName: 'com.example.android', installApp: true },
 * };
 * ```
 */
export interface ActionCodeSettings {
  /** The URL the user is redirected to after completing the action */
  url: string;
  /** Whether the code should be handled in-app (true) or in a web page (false) */
  handleCodeInApp?: boolean;
  /** Optional iOS bundle identifier */
  iOS?: { bundleId: string };
  /** Optional Android package name and settings */
  android?: { packageName: string; installApp?: boolean; minimumVersion?: string };
  /** Optional dynamic link domain */
  dynamicLinkDomain?: string;
}
