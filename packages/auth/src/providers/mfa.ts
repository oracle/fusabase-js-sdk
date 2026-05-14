import { TotpMultiFactorAssertion } from '../internal/phone.js';

export class TotpMultiFactorGenerator {
    static FACTOR_ID: string = 'totp';

    static assertionForEnrollment(secret: string, verificationCode: string): TotpMultiFactorAssertion {
        throw new Error('Not implemented');
    }

    static assertionForSignIn(verificationCode: string): TotpMultiFactorAssertion {
        throw new Error('Not implemented');
    }
}
