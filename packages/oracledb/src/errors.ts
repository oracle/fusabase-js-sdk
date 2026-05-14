// errors/errors.d.ts

/**
 * Map of all hardcoded error messages.
 */
export const errorMessages = {
  deleteFieldNotAllowedInSet: 'Delete FieldValue is not allowed in set method.',
  serverTimestampNotSupported: 'FieldValue.serverTimestamp is not supported in oracledb version 1',
  valueCannotBeNull: 'Value cannot be null or undefined',
  expectedType: 'Expected one of {0} but got {1}',
  networkIssue: 'Network issue.',
  expectedInstance: 'Expected instance of {0} but got {1}',
  unknownError: 'Unknown',
  invalidSecondsRange: 'Seconds must be from 0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z inclusive.',
  invalidNanosecondsRange: 'Nanoseconds must be from 0 to 999,999,999 inclusive.',
  notTimestampInstance: 'The provided object must be an instance of Timestamp.',
  invalidTimestampString: 'Invalid timestamp string: {0}',
  transactionEnded: 'Transaction has ended!',
  invalidDocumentReference: 'Invalid document reference passed',
  notSnapshotMetadataInstance: 'The other instance to be compared should be an instance of SnapshotMetadata',
  cannotSetNullEntry: "Can't set null entry!",
  entryNotFound: 'Entry not found!',
  unsupportedBundleDataType:
    'Supported data types for bundle load are ArrayBuffer, ReadableStream <Uint8Array> and string',
  documentDataNotPresent: 'Document data is not present.',
  unsupportedDataType: 'Unsupported data type',
  viewNameCannotBeEmpty: 'View name cannot be empty for a duality view collection!',
  incorrectDualityViewPath: 'Incorrect path for DualityView',
  docIdNotReturned: 'DocID not returned!',
  notDualityViewColReference:
    'The other instance to be compared should be an instance of DualityViewColReference',
  pathAndParentCannotBeNull: 'Both path and parent cannot be null!',
  incorrectDualityViewDocId: 'Incorrect duality view document id!',
  parentCollectionCannotBeNull: "Parent Collection can't be null",
  incorrectDualityViewDocPath: 'Incorrect path for DualityView document',
  notDualityViewDocReference:
    'The other instance to be compared should be an instance of DualityViewDocReference',
  documentIdNotFound: 'DocumentID not found',
  errorFetchingDocumentUpdate: 'Error occurred while fetching document during update.',
  noSuchDocument: 'No such doc exists!',
  unsubscribeCalled: 'Unsubscribe called!',
  notFieldPathInstance: 'The other instance to be compared should be a FieldPath.',
  notFieldValueInstance: 'The provided object must be an instance of FieldValue.',
  collectionPathCannotBeEmpty: 'Path cannot be empty for a collection!',
  incorrectCollectionPath: 'Incorrect path for Collection',
  notCollectionReference: 'The other instance to be compared should be an instance of CollectionReference',
  incorrectDocumentId: 'Incorrect document id!',
  notDocumentReference: 'The other instance to be compared should be an instance of DocumentReference',
  notQuerySnapshot: 'The other instance to be compared should be an instance of QuerySnapshot',
  documentDoesNotExist: 'Document does not exist!',
  notDocumentSnapshot: 'The other instance to be compared should be an instance of DocumentSnapshot',
  notAggregateField: 'The other instance to be compared should be an instance of AggregateField.',
  notAggregateQuery: 'The other instance to be compared should be an instance of AggregateQuery.',
  notAggregateQuerySnapshot:
    'The other instance to be compared should be an instance of AggregateQuerySnapshot.',
  notQueryInstance: 'The other instance to be compared should be an instance of Query.',
  operationNotSupportedInNamedQuery: 'Operation is not supported in namedQuery',
  invalidArrayContainsCombination: "array-contains-any can't be used with array-contains.",
  incorrectComparisonOperator: 'Incorrect comparison operator',
  invalidDirection: 'Invalid direction.',
  invalidLimit: 'Invalid limit provided.',
  lastSnapshotNotFound: 'Could not locate last snapshot in indexed db',
} as const;

export type ErrorMessageKey = keyof typeof errorMessages;

/**
 * Formats a message template with provided arguments.
 * @param template - The message template with {0}, {1}, etc. placeholders.
 * @param args - The values to insert into the template.
 * @returns The formatted message.
 */
export function formatMessage(template: string, ...args: unknown[]): string {
  return template.replace(/\{(\d+)\}/g, (match, index) => {
    const value = args[parseInt(index, 10)];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Gets a formatted error message by key and optional parameters.
 * @param key - The key from `errorMessages`.
 * @param args - Optional parameters for placeholder replacement.
 * @returns Formatted error message.
 */
export function getErrorMessage(key: ErrorMessageKey, ...args: unknown[]): string {
  const template = errorMessages[key];
  return formatMessage(template, ...args);
}


/**
 * Represents an error returned by Oracledb operations.
 */
export declare class OracledbError extends Error {
  /** Error code (e.g., "not-found", "permission-denied") */
  readonly code: string;

  /** Optional details of the error */
  readonly details?: any;

  constructor(code: string, message: string, details?: any);
}
