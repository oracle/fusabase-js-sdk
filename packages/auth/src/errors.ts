/**
 * Internal Error Codes being used to generate AuthError
 */
/**
 * @internal
 */
export enum ErrorCode {
  INVALID_ARGS = 400,
  INVALID_USER_TOK = 401,
  NOT_FOUND = 404,
  WRONG_PASS = 403,
  POPUP_BLOCKED = 498,
  SERVER_ERROR = 500,
  NOT_IMPLEMENT = 501,
  UNAVAILABLE = 502,
  OPR_NOT_ALLOWED = 599,
  NETWORK_ISSUE = 408,
  UNKNOWN = 520
}

/**
 * @internal
 */
export enum ErrorCodeMessage {
  INVALID_ARGS = 'argument-error',
  INVALID_USER_TOK = 'invalid-user-token',
  NOT_FOUND = 'user-not-found',
  WRONG_PASS = 'wrong creds',
  POPUP_BLOCKED = 'popup-blocked',
  SERVER_ERROR = 'internal',
  NOT_IMPLEMENT = 'not-implemented',
  UNAVAILABLE = 'unavailable',
  OPR_NOT_ALLOWED = 'operation-not-allowed',
  NETWORK_ISSUE = 'network-error',
  UNKNOWN = 'unknown'
}

/**
 * Map of error message templates
 */
/**
 * @internal
 */
export const errorMessageTemplates = Object.freeze({
  INVALID_NULL: 'Invalid %s: value cannot be null or undefined',
  INVALID_TYPE_PARAM: 'Invalid %s: expected one of %s but got %s',
  INVALID_PARAM: 'Invalid %s',
  NETWORK_ISSUE: 'Network issue.',
  PLEASE_REAUTHENTICATE: 'Please reauthenticate!',
  METHOD_NOT_IMPLEMENTED: 'Method not implemented!',
  USER_REAUTHENTICATE: 'User needs to reauthenticate!',
  EMPTY_TOKEN: 'Empty token provided',
  INVALID_TOKENS: 'Invalid tokens!',
  INVALID_PROVIDER: 'Invalid provider specified',
  INVALID_CREDENTIAL: 'Invalid credential',
  UNKNOWN_PROVIDER_ID: 'Unknown providerId encountered after redirect',
  INVALID_USER_INSTANCE: 'Invalid user instance passed',
  REQUEST_FAILED: 'Request failed',
  INVALID_PERSISTENCE: 'Invalid persistence passed',
  INVALID_PROVIDER_ID_SAML: 'Invalid providerId provided to SAMLAuthProvider',
  INVALID_CREDENTIALS: 'Invalid credentials provided to credential()',
  NO_TOKEN: 'No Token provided',
  INVALID_CREDENTIALS_SIMPLE: 'Invalid credentials',
  METHOD_NOT_SUPPORTED_IDCS: 'Method is not supported in IDCS authentication',
  METHOD_NOT_SUPPORTED_ONPREM: 'This method is not supported in onprem',
  METHOD_NOT_SUPPORTED_BASE_LDAP: 'Method is not supported in base or ldap authentication',
  NULL_TOKEN: 'Null token!',
  PASSWORD_RESET_FAILED: 'Password reset failed',
  UNSUPPORTED_AUTHTYPE: 'Unsupported authType: %s',
  DOMAIN_URL_NOT_PROVIDED: 'Domain URL is not provided',
  CLIENT_ID_NOT_PROVIDED: 'Client ID is not provided',
  CLIENT_SECRET_NOT_PROVIDED: 'Client Secret is not provided',
  NO_OPERATION: 'No operation to perform',
  PASSWORD_UPDATE_FAILED: 'Password update failed',
  INVALID_AUTH_INSTANCE: 'Invalid authentication instance',
  INVALID_APP_INSTANCE: 'Invalid app instance',
  INVALID_USER: 'Invalid user instance',
  FAILED_FETCH: 'Failed to fetch %s',
  FAILED_OPERATION: 'Failed to %s',
  POPUP_BLOCKED_SIMPLE: 'Popup blocked',
  METHOD_NOT_SUPPORTED: 'Method is not supported in %s authentication',
} as const);

/**
 * @internal
 */
export type ErrorMessageKey = keyof typeof errorMessageTemplates;

/**
 * Function to get formatted error message from template
 * @param key - The key in errorMessageTemplates
 * @param args - Arguments to replace %s placeholders
 * @returns Formatted message
 */
/**
 * @internal
 */
export function getErrorMessage(key: ErrorMessageKey, ...args: string[]): string {
  const template = errorMessageTemplates[key];
  if (!template) {
    throw new Error(`Unknown error key: ${key}`);
  }
  return template.replace(/%s/g, () => args.shift() ?? '');
}

/**
 * @internal
 */
export function authErrorHandler(err: any): AuthError {
  if (err instanceof AuthError) {
    return err;
  }
  let code: ErrorCodeMessage | null = null;

  if (err.status === ErrorCode.INVALID_ARGS)
    code = ErrorCodeMessage.INVALID_ARGS;
  else if (err.status === ErrorCode.INVALID_USER_TOK)
    code = ErrorCodeMessage.INVALID_USER_TOK;
  else if (err.status === ErrorCode.NOT_FOUND)
    code = ErrorCodeMessage.NOT_FOUND;
  else if (err.status === ErrorCode.WRONG_PASS)
    code = ErrorCodeMessage.WRONG_PASS;
  else if (err.status === ErrorCode.POPUP_BLOCKED)
    code = ErrorCodeMessage.POPUP_BLOCKED;
  else if (err.status === ErrorCode.SERVER_ERROR)
    code = ErrorCodeMessage.SERVER_ERROR;
  else if (err.status === ErrorCode.NOT_IMPLEMENT)
    code = ErrorCodeMessage.NOT_IMPLEMENT;
  else if (err.status === ErrorCode.UNAVAILABLE)
    code = ErrorCodeMessage.UNAVAILABLE;
  else if (err.status === ErrorCode.OPR_NOT_ALLOWED)
    code = ErrorCodeMessage.OPR_NOT_ALLOWED;
  else if (err.status === ErrorCode.NETWORK_ISSUE)
    code = ErrorCodeMessage.NETWORK_ISSUE;
  else
    code = ErrorCodeMessage.UNKNOWN;

  let error = new AuthError(code, err);

  return error;
}

export class AuthError extends Error {
  public authType: any;
  public code: string;
  public name: string;
  public status: ErrorCode;

  constructor(code: ErrorCodeMessage | null, error: any) {
    super(error.message);
    this.authType = error.authType;
    this.stack = error.stack;
    this.status = ErrorCode.UNKNOWN;
    this.code = 'auth/' + code;
    this.name = 'AuthError';
  }
}

/**
 * @internal
 */
export function nullCheck(value: any, message: string): void {
  if (value == null) {
    let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, "Null value");
    error.message = message;
    error.status = ErrorCode.INVALID_ARGS;
    throw authErrorHandler(error);
  }
}

/**
 * @internal
 */
export const typeStrings = Object.freeze({
  NULL: "null",
  ARRAY: "array",
  DATE: "date",
  REGEXP: "regexp",
  NUMBER: "number",
  INT: "int",
  FLOAT: "float",
  OBJECT: "object",
  STRING: "string",
  BOOL: "boolean",
  BIGINT: "bigint",
  SYMBOL: "symbol",
  FUNCTION: "function"
});

/**
 * @internal
 */
export function argCheck(value: any, message?: string, throwNullError?: boolean, expectedTypes: string[] = []): any {
  if (value === null || value === undefined) {
    if (!throwNullError) {
      return;
    }
    let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, message || "Value cannot be null or undefined");
    error.status = 400;
    throw authErrorHandler(error);
  }

  // if no type check required
  if (!Array.isArray(expectedTypes) || expectedTypes.length === 0) {
    return value;
  }

  function detectType(val: any): string {
    if (val === null) return typeStrings.NULL;
    if (Array.isArray(val)) return typeStrings.ARRAY;
    if (val instanceof Date) return typeStrings.DATE;
    if (val instanceof RegExp) return typeStrings.REGEXP;
    if (typeof val === typeStrings.NUMBER) {
      return Number.isInteger(val) ? typeStrings.INT : typeStrings.FLOAT;
    }
    if (typeof val === "object") return typeStrings.OBJECT;
    return typeof val; // string, boolean, bigint, symbol, function
  }

  const actualType = detectType(value);

  if (!expectedTypes.map(t => t.toLowerCase()).includes(actualType)) {
    let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,
      message || `Expected one of [${expectedTypes.join(", ")}] but got ${actualType}`
    );
    error.status = 400;
    throw authErrorHandler(error);
  }

  return value;
}
