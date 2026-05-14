import { UserCredential } from '../internal/credential.js';
import { AuthError, ErrorCodeMessage } from '../errors.js';
import { AuthProvider } from './provider.js';
import { OAuthCredential } from '../internal/phone.js';
import { authErrorHandler,argCheck,typeStrings } from '../errors.js';

/**
 * The IDCSAuthProvider class allows you to generate credentials for IDCS sign-in.
 * It provides methods for obtaining credentials, adding scopes, and setting custom parameters.
 *
 * @example
 * ```ts
 * // Example usage to generate OAuthCredential using IDCS ID token and access token
 * const idcsCredential = IDCSAuthProvider.credential('GOOGLE_ID_TOKEN', 'GOOGLE_ACCESS_TOKEN');
 * ```
 */
export class IDCSAuthProvider extends AuthProvider {
  private _providerType = "";
  private scopes: string[];
  private customParameters: Record<string, unknown>;

  /** Provider ID for IDCS sign-in */
    static PROVIDER_ID: string = 'idcs';

    /** Sign-in method for IDCS authentication */
    static IDCS_SIGN_IN_METHOD: string = 'idcs';

  constructor() {
    super(IDCSAuthProvider.PROVIDER_ID);
    this.scopes = [];
    this.customParameters = {};
  }

  /**
  * @property 
  */
  get providerName() {
    return IDCSAuthProvider.IDCS_SIGN_IN_METHOD;
  }

  /**
  * @property 
  */
  get providerType() {
    return this._providerType;
  }

  /**
  * @property 
  */
  set providerType(type) {
    argCheck(type, "Invalid type", true, [typeStrings.STRING]);
    this._providerType = type;
  }

  /**
     * Creates an OAuthCredential using the provided IDCS idToken and accessToken.
     * This method is used to authenticate users via IDCS OAuth.
     *
     * @param idToken The ID token obtained from the IDCS sign-in.
     * @param accessToken The access token obtained from the IDCS sign-in.
     * @returns An OAuthCredential object that can be used for sign-in or linking a provider.
     */
  static credential(idToken?: string, accessToken?: string): OAuthCredential {
    if (!accessToken && !idToken) {
      let err = new AuthError(ErrorCodeMessage.INVALID_ARGS,"No Token provided");
      throw authErrorHandler(err);
    }
    argCheck(idToken, "Invalid id token", false, [typeStrings.STRING]);
    argCheck(accessToken, "Invalid access token", false, [typeStrings.STRING]);

    let oauthCreds = new OAuthCredential(IDCSAuthProvider.PROVIDER_ID,
      IDCSAuthProvider.IDCS_SIGN_IN_METHOD);
    oauthCreds.accessToken = accessToken;
    oauthCreds.idToken = idToken;
    return oauthCreds;
  }

  /**
     * Extracts an OAuthCredential from the user credential object.
     * This method allows you to extract the credentials that were used during the sign-in or link operation.
     *
     * @param userCredential The UserCredential object returned after a successful sign-in or link operation.
     * @returns An OAuthCredential or null if not available.
     */
    static credentialFromResult(userCredential: UserCredential): OAuthCredential | null {
    if (!(userCredential instanceof UserCredential)) {
      let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,`Invalid credentials`);
      throw authErrorHandler(error);
    }
    return userCredential.credential;
  }

  /**
     * Extracts an OAuthCredential from an AuthError.
     * This method helps to extract credentials from an AuthError if available.
     *
     * @param error The error object that occurred during the sign-in or link process.
     * @returns An OAuthCredential or null if not available from the error.
     *
     * @example
     * ```ts
     * try {
     *   // Attempt some auth operation that might throw an error
     * } catch (error) {
     *   const idcsCredential = IDCSAuthProvider.credentialFromError(error);
     *   console.log(idcsCredential);
     * }
     * ```
     */
    static credentialFromError(error: AuthError): OAuthCredential | null {
        if (!(error instanceof AuthError)) {
          return null;
        }
        return null;
    }
  
  /**
     * Adds additional scope to the IDCS OAuth provider.
     * Scopes allow you to request additional user data from IDCS, such as profile or email.
     *
     * @param scope The scope to add to the IDCS OAuth request.
     * @returns The current instance of IDCSAuthProvider for method chaining.
     *
     * @example
     * ```ts
     * const provider = new IDCSAuthProvider();
     * provider.addScope('email').addScope('profile');
     * ```
     */
    addScope(scope: string): this {
      if (!this.scopes) {
        this.scopes = [];
      }
      this.scopes.push(scope);
      return this;
    }

    /**
     * Sets custom parameters for the IDCS OAuth provider.
     * Custom parameters allow you to control the behavior of the IDCS OAuth flow.
     *
     * @param params A record of key-value pairs for the custom parameters.
     * @returns The current instance of IDCSAuthProvider for method chaining.
     *
     * @example
     * ```ts
     * const provider = new IDCSAuthProvider();
     * provider.setCustomParameters({ prompt: 'select_account' });
     * ```
     */
    setCustomParameters(params: Record<string, unknown>): this {
      this.customParameters = params;
      return this;
    }
}
