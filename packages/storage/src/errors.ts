/**
 * @internal
 */
export enum StorageErrorCode {
  INVALID_ARGUMENT,
  UNAUTHENTICATED,
  UNAUTHORIZED,
  INTERNAL_ERROR,
  CANCELED,
  NOT_IMPLEMENTED,
  OBJECT_NOT_FOUND,
  NETWORK_ISSUE,
  UNKNOWN
}

/**
 * @internal
 */
export const StorageErrorCodeMessage = Object.freeze({
  [StorageErrorCode.INVALID_ARGUMENT]: 'invalid-argument',
  [StorageErrorCode.UNAUTHENTICATED]: 'unauthenticated',
  [StorageErrorCode.UNAUTHORIZED]: 'permission-denied',
  [StorageErrorCode.INTERNAL_ERROR]: 'internal',
  [StorageErrorCode.CANCELED]: 'aborted',
  [StorageErrorCode.NOT_IMPLEMENTED]: 'not-implemented',
  [StorageErrorCode.OBJECT_NOT_FOUND]: 'not-found',
  [StorageErrorCode.NETWORK_ISSUE]: 'network-error',
  [StorageErrorCode.UNKNOWN]: 'unknown'
});

/**
 * @internal
 */
export function storageErrorHandler(err: any): StorageError {
  let code: StorageErrorCode = StorageErrorCode.UNKNOWN;
  if (err.status === 400) {
    code = StorageErrorCode.INVALID_ARGUMENT;
  } else if (err.status === 401) {
    code = StorageErrorCode.UNAUTHENTICATED;
  } else if (err.status === 404) {
    code = StorageErrorCode.OBJECT_NOT_FOUND;
  } else if (err.status === 403) {
    code = StorageErrorCode.UNAUTHORIZED;
  } else if (err.status === 500) {
    code = StorageErrorCode.INTERNAL_ERROR;
    } else if (err.status === 408) {
    code = StorageErrorCode.NETWORK_ISSUE;
  } else if (err.status === 501) {
    code = StorageErrorCode.NOT_IMPLEMENTED;
  } else if (err.status === 499) {
    code = StorageErrorCode.CANCELED;
  }

  const error = new StorageError(code, err.message || '', err.status, err.stack);
  return error;
}

/**
 * @internal
 */
export function nullCheck(value: any, message: string): void {
  if (value === null || value === undefined) {
    const err = new StorageError(StorageErrorCode.INVALID_ARGUMENT, message);
    err.status = 400;
    throw storageErrorHandler(err);
  }
}

/**
 * Class representing errors thrown by FUSABASE Storage Service.
 */
/**
 * @internal
 */
export class StorageError extends Error {
  /** The error code. */
  public code: string;
  /** The HTTP status code. */
  public status: number | null;
  /** Whether the error is from the server. */
  public server: boolean;
  /** The server response. */
  public serverResponse: any;
  /** Custom data associated with the error. */
  public customData: { serverResponse: any };

  /**
   * Constructs a StorageError.
   * @param code - The error code.
   * @param message - The error message.
   * @param status_ - The HTTP status code.
   * @param stack - The stack trace.
   */
  constructor(
    code:StorageErrorCode,
    message = '',
    status_ = null,
    stack = null
  ) {
    if (!Object.values(StorageErrorCode).includes(code)) {
      throw new Error(`Invalid StorageErrorCode: ${code}`);
    }
    if (typeof message !== 'string') {
      throw new Error('Message must be a string');
    }
    super(message);
    this.code = `storage/${StorageErrorCodeMessage[code]}`;
    this.name = 'StorageError';
    this.status = status_;
    this.server = false;
    this.serverResponse = null;
    this.customData = {
      serverResponse: null
    };
    this.stack = stack ?? undefined;
  }

  /**
 * @internal
 */
  _codeEquals(code: StorageErrorCode): boolean {
    return this.code === `storage/${code}`;
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
 * Formats a message template with arguments.
 * Replaces placeholders like {0}, {1}, etc. with provided argument values.
 *
 * @param template - The message template with {0}, {1}, etc.
 * @param args - The arguments to insert into the template.
 * @returns The formatted message.
 */
/**
 * @internal
 */
export function formatMessage(template: string, ...args: string[]): string {
  return template.replace(/\{(\d+)\}/g, (match, index) => {
    const value = args[parseInt(index, 10)];
    return value !== undefined ? value : match;
  });
}

/**
 * Map of hardcoded storage-related error messages.
 */
/**
 * @internal
 */
export const StorageErrorMessages = {
  UNKNOWN: 'Unknown error occurred.',
  VALUE_CANNOT_BE_NULL: 'Value cannot be null or undefined.',
  EXPECTED_TYPE: 'Expected one of {0} but got {1}.',
  UPLOAD_ABORTED: 'Upload aborted.',
  INCORRECT_PATH: 'Incorrect path: {0}.',
  NETWORK_ISSUE: 'Network issue.',
  INVALID_METADATA: 'Only contentType is supported in metadata and it should be a valid string.',
  INVALID_UPLOAD_FORMAT: 'Invalid upload format! Upload as Blob, ArrayBuffer or Uint8Array.',
  EMPTY_UPLOAD: 'Upload data must be greater than 0 bytes.',
  MULTIPART_NOT_INITIALIZED: 'Multipart not initialized properly.',
  PAR_URL_CREATION_FAILED: 'PAR URL creation failed.',
  COMMIT_FAILED: 'Commit failed.',
  FAILED_DOWNLOAD_URL: 'Failed to get object downloadURL for {0}.',
  FAILED_DELETE: 'Failed to delete object {0}.',
  FAILED_FETCH_METADATA: 'Failed to fetch metadata for {0}.',
  UPLOAD_EXCEEDS_LIMIT: 'Upload size exceeds the configured limit of {0} bytes.',
  DOWNLOAD_EXCEEDS_LIMIT: 'Download size exceeds the requested limit of {0} bytes.',
  INVALID_DOWNLOAD_SIZE: 'Invalid download size',
  INVALID_CHILD_PATH: 'Invalid child path',
  INVALID_OPTIONS_OBJECT: 'Invalid options object',
  INVALID_EVENT_PASSED: 'Invalid event passed',
  INVALID_NEXT_CALLBACK: 'Invalid next callback',
  INVALID_ERROR_CALLBACK: 'Invalid error callback',
  INVALID_COMPLETE_CALLBACK: 'Invalid complete callback',
  INVALID_SUCCESS_CALLBACK: 'Invalid success callback',
  INVALID_CALLBACK: 'Invalid callback',
  INVALID_REFERENCE_PATH: 'Invalid reference path',
  INVALID_REFERENCE_URL: 'Invalid reference url',
  INVALID_REFERENCE: 'Invalid reference object',
  INVALID_APP: 'Invalid app instance',
  INVALID_STORAGE: 'Invalid storage instance',
  INVALID_URL_REFERENCE: 'Url reference cannot be created above another reference',
} as const;

/**
 * @internal
 */
export type StorageErrorKey = keyof typeof StorageErrorMessages;

/**
 * Retrieves and formats a storage error message by key.
 * @param key - The key in `StorageErrorMessages`.
 * @param args - Optional arguments for placeholders.
 * @returns The formatted message.
 */
/**
 * @internal
 */
export function getStorageErrorMessage(key: StorageErrorKey, ...args: string[]): string {
  const template = StorageErrorMessages[key];
  return formatMessage(template, ...args);
}

/**
 * @internal
 */
export function argCheck(
  value: any,
  message: string | undefined,
  throwNullError: boolean,
  expectedTypes: string[] = []
): any {
  if (value === null || value === undefined) {
    if (!throwNullError) {
      return;
    }
    const error = new StorageError(
      StorageErrorCode.INVALID_ARGUMENT,
      message || 'Value cannot be null or undefined'
    );
    error.status = 400;
    throw storageErrorHandler(error);
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
    if (typeof val === 'object') return typeStrings.OBJECT;
    return typeof val; // string, boolean, bigint, symbol, function
  }

  const actualType = detectType(value);

  if (!expectedTypes.map((t) => t.toLowerCase()).includes(actualType.toLowerCase())) {
    const error = new StorageError(
      StorageErrorCode.INVALID_ARGUMENT,
      message || `Expected one of [${expectedTypes.join(', ')}] but got ${actualType}`
    );
    error.status = 400;
    throw storageErrorHandler(error);
  }

  return value;
}
