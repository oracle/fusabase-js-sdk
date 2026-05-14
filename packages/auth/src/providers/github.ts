import { UserCredential } from '../internal/credential.js';
import { AuthError, ErrorCode, ErrorCodeMessage } from '../errors.js';
import { AuthProvider } from './provider.js';
import { OAuthCredential } from '../internal/phone.js';
import { authErrorHandler,argCheck,typeStrings } from '../errors.js';

/**
 * The GithubAuthProvider class allows you to generate credentials for Github sign-in.
 * It provides methods for obtaining credentials, adding scopes, and setting custom parameters.
 *
 * @example
 * ```ts
 * // Example usage to generate OAuthCredential using Github access token
 * const githubCredential = GithubAuthProvider.credential(undefined, 'GITHUB_ACCESS_TOKEN');
 * ```
 */
export class GithubAuthProvider extends AuthProvider {
  private _providerType = "";

  static GITHUB_SIGN_IN_METHOD: string = "github";
  static PROVIDER_ID: string = 'github';

  constructor() {
    super(GithubAuthProvider.PROVIDER_ID);
  }

  /**
  * @property 
  */
  get providerName() {
    return GithubAuthProvider.GITHUB_SIGN_IN_METHOD;
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
  * @property 
  */
  static credential(idToken?: string, accessToken?: string) {
    if (!accessToken && !idToken) {
      let err = new AuthError(ErrorCodeMessage.INVALID_ARGS,"No Token provided");
      err.status = ErrorCode.INVALID_USER_TOK;
      throw authErrorHandler(err);
    }
    argCheck(idToken, "Invalid id token", false, [typeStrings.STRING]);
    argCheck(accessToken, "Invalid access token", false, [typeStrings.STRING]);
    let oauthCreds = new OAuthCredential(GithubAuthProvider.PROVIDER_ID,
      GithubAuthProvider.GITHUB_SIGN_IN_METHOD);
    oauthCreds.accessToken = accessToken;
    oauthCreds.idToken = idToken;
    return oauthCreds;
  }

  static credentialFromResult(userCredential: UserCredential): OAuthCredential | null {
    if (!(userCredential instanceof UserCredential)) {
      let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,`Invalid credentials`);
      error.status = 400;
      throw authErrorHandler(error);
    }
    return userCredential.credential;
  }

  static credentialFromError(error: AuthError): OAuthCredential | null {
    return null;
  }

  addScope(scope: string): this {
        throw new AuthError(ErrorCodeMessage.NOT_IMPLEMENT,'Not implemented');
    }

    setCustomParameters(params: Record<string, unknown>): this {
        throw new AuthError(ErrorCodeMessage.NOT_IMPLEMENT,'Not implemented');
    }
}
