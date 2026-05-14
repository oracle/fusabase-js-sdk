/**
 * Base class for authentication providers.
 *
 * This class provides a common interface for all authentication providers,
 * storing the provider ID which identifies the specific authentication method.
 */
export class AuthProvider {
  providerId:string;

  constructor(providerId:string) {
    this.providerId = providerId;
  }

}
