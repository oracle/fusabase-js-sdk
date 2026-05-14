import { AuthCredential } from './credential.js';
import { authErrorHandler, argCheck, typeStrings } from '../errors.js';

/**
 * Represents OAuth credentials returned by an OAuthProvider.
 *
 * @example
 * ```ts
 * import { OAuthCredential, GoogleAuthProvider } from 'fusabase/auth';
 * const credential = GoogleAuthProvider.credential(idToken);
 * ```
 */
export class OAuthCredential extends AuthCredential {
  /** The access token used for OAuth authentication */
  accessToken?: string;
  /** The ID token used for OAuth authentication */
  idToken?: string;

  /** Converts the credential to a JSON serializable object */
  toJSON(): { providerId: string; signInMethod: string; accessToken?: string; idToken?: string } {
    const cred = {
      providerId: this.providerId,
      signInMethod: this.signInMethod,
      accessToken: this.accessToken,
      idToken: this.idToken
    };
    return cred;
  }

  /**
   * Method to convert the data in JSON format to data members.
   */
  static fromJSON(authCredential: string): OAuthCredential {
    argCheck(authCredential, "Invalid object", true, [typeStrings.OBJECT]);
    const res = JSON.parse(authCredential);
    const oauth = new OAuthCredential(res.providerId, res.signInMethod);
    oauth.accessToken = res.accessToken;
    oauth.idToken = res.idToken;
    return oauth;
  }
}

/**
 * Represents credentials returned by PhoneAuthProvider.
 *
 * @example
 * ```ts
 * import { PhoneAuthCredential, PhoneAuthProvider } from 'fusabase/auth';
 * const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
 * ```
 */
export class PhoneAuthCredential extends AuthCredential {
  /** Converts the credential to a JSON serializable object */
  toJSON(): { providerId: string; signInMethod: string } {
    throw new Error('Method not implemented.');
  }
}

/**
 * Represents a phone-based MultiFactor assertion for MFA.
 *
 * @example
 * ```ts
 * import { PhoneMultiFactorAssertion, PhoneMultiFactorGenerator } from 'fusabase/auth';
 * const assertion = PhoneMultiFactorGenerator.assertion(credential);
 * ```
 */
export class PhoneMultiFactorAssertion {
  /** Converts the assertion to a JSON serializable object */
  toJSON(): object {
    throw new Error('Method not implemented.');
  }
}

/**
 * Represents a TOTP-based MultiFactor assertion for MFA.
 *
 * @example
 * ```ts
 * import { TotpMultiFactorAssertion, TotpMultiFactorGenerator } from 'fusabase/auth';
 * const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret);
 * ```
 */
export class TotpMultiFactorAssertion {
  /** Converts the assertion to a JSON serializable object */
  toJSON(): object {
    throw new Error('Method not implemented.');
  }
}
