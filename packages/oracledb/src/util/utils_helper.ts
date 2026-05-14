import fusabase from '../../../app/src/fusabase-internal.js';
import { LogLevel } from '../../../logger/LogLevel.js';
import { FieldValue } from '../field/value.js';
import { Timestamp } from '../field/value.js';
import { oracledbErrorHandler } from './utils.js';
import { escapeFieldName } from './utils.js';
import { identifyValueType } from './utils.js';
import { validateDenseVector, validateSparseEmbedding } from './utils.js';

/* Sets the log level for all registered apps in the Fusabase environment.
 * @param log - The log level string to apply.
 */
export function setLogLevel(log: LogLevel): void {
  for (let i = 0; i < fusabase.apps.length; i++) {
    fusabase.apps[i].logLevel = log;
  }
}

/**
 * Flattens an array of dot-separated path strings into an array of individual path tokens.
 *
 * @param arr - Array of path strings, e.g., ['foo.bar', 'baz'].
 * @returns Array of path tokens, e.g., ['foo', 'bar', 'baz'].
 *
 * @example
 *   flattenArray(['foo.bar', 'baz']); // => ['foo', 'bar', 'baz']
 */
/**
   * @internal
   */
export function flattenArray(arr: string[]): string[] {
  return arr.reduce((result: string[], str: string) => {
    const parts = str.split('.');
    result.push(...parts);
    return result;
  }, []);
}

/**
 * Performs a deep equality check for two JSON-compatible objects.
 *
 * @param a - First JSON object.
 * @param b - Second JSON object.
 * @returns True if the two objects are deeply equal, otherwise false.
 */
/**
   * @internal
   */
export function deepEqual(a: any, b: any): boolean {
  // Check if both are strictly equal (covers NaN case)
  if (a === b) return true;

  // Check if either is not an object or is null/undefined
  if (typeof a !== 'object' || a === null ||
      typeof b !== 'object' || b === null) {
    return false;
  }

  // Both are arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // One is an array and the other is not
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  // Both are plain objects
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

/**
 * Checks if a FieldValue is present in the JSON object, including deeply.
 * Throws if a delete FieldValue is used with the 'set' method.
 *
 * @param obj - The JSON object to check.
 * @param method - The write method ("set", "update" etc).
 * @returns True if the object or any key contains a FieldValue, otherwise false.
 * @throws OracledbError if method is 'set' and FieldValue:delete is found.
 */
/**
   * @internal
   */
export function checkForFieldValue(obj: any, method: string): boolean {
  if (obj == null) {
    return false;
  }
  if (obj instanceof FieldValue) {
    if (obj.operation === "FieldValue:delete" && method === "set") {
      const error = new Error("Delete FieldValue is not allowed in set method.") as Error & { status?: number };
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    return true;
  } else if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (checkForFieldValue(obj[key], method)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Convert all Timestamp instances to timestamp strings within a JSON object.
 */
/**
   * @internal
   */
export function parseTimestamp(obj: any): any {
  if (obj == null) {
    return null;
  }
  if (obj instanceof Timestamp) {
    return obj.toTimestampString();
  } else if (Array.isArray(obj)) {
    return obj.map(item => parseTimestamp(item));
  } else if (typeof obj === 'object') {
    const newObj: Record<string, any> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = parseTimestamp(obj[key]);
      }
    }
    return newObj;
  } else {
    return obj;
  }
}

/**
 * Recursively convert timestamp strings to Timestamp objects in a JSON object.
 */
/**
   * @internal
   */
export function parseTimeInDocument(obj: any): any {
  if (obj == null) {
    return null;
  }
  const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/;
  const timestampPattern1 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

  if (
    typeof obj === 'string' &&
    (timestampPattern.test(obj) || timestampPattern1.test(obj))
  ) {
    return Timestamp.fromTimestampString(obj);
  } else if (Array.isArray(obj)) {
    return obj.map(item => parseTimeInDocument(item));
  } else if (typeof obj === 'object') {
    const newObj: Record<string, any> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = parseTimeInDocument(obj[key]);
      }
    }
    return newObj;
  } else {
    return obj;
  }
}

/**
   * @internal
   */
export function flattenUpdates(
  obj: Record<string, any>,
  prefix: string = "",
  result: Record<string, any> = {}
): Record<string, any> {
  let hasKeys = false;

  for (let key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    hasKeys = true;

    const value = obj[key];
    const path = prefix ? `${prefix}.${key}` : key;

    if (
      value !== null &&
      typeof value === "object" &&
      !(value instanceof FieldValue) &&
      !(value instanceof Timestamp) &&
      !Array.isArray(value)
    ) {
      const beforeSize = Object.keys(result).length;
      flattenUpdates(value, path, result);
      if (Object.keys(value).length === 0) {
        result[path] = {};
      }

    } else {
      result[path] = value;
    }
  }
  if (!hasKeys && prefix) {
    result[prefix] = {};
  }

  return result;
}

/**
 * Recursively updates nested fields (dot-notation or FieldPath# notation).
 */
/**
   * @internal
   */
export function updateNestedData(query: any, oldData: any, updates: any): any {
  let newData = JSON.parse(JSON.stringify(oldData));

  // Flatten nested updates first
  const flatUpdates = flattenUpdates(updates);

  for (let key in flatUpdates) {
    const value = flatUpdates[key];

    if (key.includes("$FieldPath$")) {
      key = key.substring(11);
      setNestedValue(query, newData, oldData, key.split("#FieldPath#"), value, true);
    } else {
      setNestedValue(query, newData, oldData, key.split("."), value, true);
    }
  }

  return newData;
}

/**
 * Sets all root-level keys in the new object (optionally using FieldPath# notation).
 */
/**
   * @internal
   */
export function setWholeData(query:any, oldData: any, updates: any, flag:any): any {
  let newData = JSON.parse(JSON.stringify(oldData));

  const flatUpdates = flattenUpdates(updates);

  for (let key in flatUpdates) {
    const value = flatUpdates[key];

    if (key.includes("$FieldPath$")) {
      let key1 = key.split("$FieldPath$");
      let key2 = "";
      for (let k in key1) {
        key2 += key1[k];
      }
      setNestedValue(query, newData, oldData, key2.split("#FieldPath#"), value, flag);
    } else {
      setNestedValue(query, newData, oldData, key.split("."), value, flag);
    }
  }

  return newData;
}

/**
 * Sets a value in an object at a nested path, handling FieldValue operations.
 */
/**
   * @internal
   */
export function setNestedValue(
  query:any,
  obj: any,
  oldData: any,
  pathArray: (string)[],
  value: any,
  flag:any
): void {
  let current = obj;
  let oldCurrent = oldData;

  for (let i = 0; i < pathArray.length - 1; i++) {
    const key = pathArray[i];

    if (!(key in current) || typeof current[key] !== "object") {
      current[key] = {};
    }

    if (!(key in oldCurrent) || typeof oldCurrent[key] !== "object") {
      oldCurrent[key] = {};
    }

    current = current[key];
    oldCurrent = oldCurrent[key];
  }

  const finalKey = pathArray[pathArray.length - 1];
  let existingValue = oldCurrent[finalKey];
  let sKey = finalKey;
  if (flag) {
    sKey = "";
    for (let i=0;i<pathArray.length-1;i++) {
      sKey += escapeFieldName(pathArray[i]);
      sKey += ".";
    }
    sKey += escapeFieldName(pathArray[pathArray.length-1]);
  }

  if (value instanceof FieldValue) {
    if (value.operation === "FieldValue:delete") {
      delete current[finalKey];
      return ;
    }
    if (flag && value.operation === "FieldValue:serverTimestamp") {
        query._serverTimestamp.push(sKey);
    } else {
        current[finalKey] = updateUsingFieldValue(finalKey, oldCurrent, value);
    }
    
  } else {
    current[finalKey] = value;
  }
}

/**
 * Gets the new value for a FieldValue operation during updates.
 */
/**
   * @internal
   */
export function updateUsingFieldValue(
  key: string,
  old_data: any,
  fieldvalue: FieldValue
): string | Array<any> | null {
  let new_value = null;
  let old_value = null;
  switch (fieldvalue.operation) {

    case "FieldValue:arrayRemove":
      if (!Array.isArray(old_data[key])) {
        return [];
      }
      new_value = [];
      old_value = old_data[key];
      try {
        for (let i = 0; i < old_value.length; i++) {
          if (!fieldvalue.value.includes(old_value[i])) {
            new_value.push(old_value[i]);
          }
        }
      } catch (e) {
        new_value = [];
      }

      break;

    case "FieldValue:arrayUnion":
      if (!Array.isArray(old_data[key] )) {
        new_value = fieldvalue.value;
        return new_value;
      }
      old_value = old_data[key];
      new_value = old_value;
      for (let i = 0; i < fieldvalue.value.length; i++) {
        if (!new_value.includes(fieldvalue.value[i])) {
          new_value.push(fieldvalue.value[i]);
        }
      }

      break;

    case "FieldValue:increment":
      if (!old_data[key] || !Number.isInteger(old_data[key])) {
        new_value = fieldvalue.value;
      } else {   
        new_value = old_data[key] + fieldvalue.value;
      }
      break;

    default:
      new_value = null;
  }
  return new_value;
}

/**
 * Checks if two arrays of primitive values are equal.
 *
 * (Only expects flat arrays, but nested arrays are handled recursively.)
 */
/**
   * @internal
   */
export function compareValues(x: any, y: any): boolean {
  function arraysEqual(arr1: any[], arr2: any[]): boolean {
    if (arr1.length !== arr2.length) return false;
    arr1 = [...arr1].sort();
    arr2 = [...arr2].sort();
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) return false;
    }
    return true;
  }
  if (Array.isArray(x) && Array.isArray(y)) {
    return arraysEqual(x, y);
  }
  return x === y;
}

/**
 * Creates a WebSocket connection and attaches event listeners.
 */
/**
   * @internal
   */
export function createConnection(url: string): WebSocket {
  const socket = new WebSocket(url);

  socket.onopen = function (e) {
    e.preventDefault();
  };
  socket.onmessage = function (event) {
    event.preventDefault();
  };
  socket.onclose = function (event) {
    event.preventDefault();
  };
  // socket.onerror = function (error) {
  //   // Optionally add more error handling/logging here

  // };

  return socket;
}

/**
 * Extracts next/error/complete callbacks from .onSnapshot-style arguments.
 */
/**
   * @internal
   */
export function extractCallbacksForSnapshot(...args: any[]): {
  next: any;
  complete: any;
  error: any;
} {
  const callback = { next: null, complete: null, error: null };

  if (typeof args[0] === 'function') {
    callback.next = args[0];
    callback.error = args.length >= 2 ? args[1] : null;
    callback.complete = args.length >= 3 ? args[2] : null;
  } else if (typeof args[0] === 'object') {
    if (args.length === 1) {
      if ("next" in args[0]) callback.next = args[0].next;
      if ("error" in args[0]) callback.error = args[0].error;
      if ("complete" in args[0]) callback.complete = args[0].complete;
    } else {
      if (typeof args[1] === 'function') {
        callback.next = args[1];
        callback.error = args.length >= 3 ? args[2] : null;
        callback.complete = args.length >= 4 ? args[3] : null;
      } else if (typeof args[1] === 'object') {
        if ("next" in args[1]) callback.next = args[1].next;
        if ("error" in args[1]) callback.error = args[1].error;
        if ("complete" in args[1]) callback.complete = args[1].complete;
      }
    }
  }
  return callback;
}

/**
   * @internal
   */
function containsFieldValueDeep(obj:any) :any {
  if (obj instanceof FieldValue) return true;
  if (obj instanceof Timestamp) return false;
  if (Array.isArray(obj)) return false;
  if (obj === null || typeof obj !== "object") return false;

  for (const k of Object.keys(obj)) {
    if (containsFieldValueDeep(obj[k])) return true;
  }
  return false;
}

function isDenseEmbeddingObject(value: any): boolean {
  return !!value && typeof value === "object" && value.type === "dense" && Array.isArray(value.values);
}

function isSparseEmbeddingObject(value: any): boolean {
  return !!value && typeof value === "object" && value.type === "sparse";
}

function isEmbeddingInput(value: any): boolean {
  // NOTE: plain JS arrays are treated as normal document fields.
  // Embedding extraction only applies to the explicit vector wrapper objects.
  return isDenseEmbeddingObject(value) || isSparseEmbeddingObject(value);
}

function extractEmbeddingOps(input: Record<string, any>): { setMap: Record<string, any>; deleteKeys: string[] } {
  const setMap: Record<string, any> = {};
  const deleteKeys: string[] = [];

  for (const key of Object.keys(input)) {
    const value = input[key];
    if (value instanceof FieldValue && value.operation === "FieldValue:deleteVector") {
      deleteKeys.push(key);
      continue;
    }
    if (isEmbeddingInput(value)) {
      if (isDenseEmbeddingObject(value)) {
        validateDenseVector(value.values, `Embedding '${key}.values' must be a numeric array.`);
      } else if (isSparseEmbeddingObject(value)) {
        validateSparseEmbedding(value);
      }
      setMap[key] = value;
    }
  }

  return { setMap, deleteKeys };
}

/**
   * @internal
   */
export function extractEmbeddingsMapForCreate(input: Record<string, any>): Record<string, any> {
  const { setMap, deleteKeys } = extractEmbeddingOps(input || {});
  if (deleteKeys.length > 0) {
    const error: any = new Error("deleteVector() is not supported in addDoc/set create payload. Use update/set merge contexts.");
    error.status = 400;
    throw oracledbErrorHandler(error);
  }
  return setMap;
}

/**
   * @internal
   */
export function createPayloadForUpdateVersion2New(
  query:any,
  input: any,
  merge: boolean,
  parentKey: string = ''
): Array<any> {
    const result: any[] = [];
  if (parentKey === '') {
    const { setMap, deleteKeys } = extractEmbeddingOps(input || {});
    if (Object.keys(setMap).length > 0) {
      result.push({ field: "$embeddings", value: setMap, op: "set", valueType: "mapValue" });
    }
    if (deleteKeys.length > 0) {
      result.push({ field: "$embeddings", value: deleteKeys, op: "delete", valueType: "arrayValue" });
    }
    input = Object.fromEntries(
      Object.entries(input || {}).filter(([k, v]) => !(k in setMap) && !(v instanceof FieldValue && v.operation === "FieldValue:deleteVector"))
    );
  }
  const seenParents = new Set();

  function walk(obj: any, prefix:any = "") {
    for (const key1 of Object.keys(obj)) {
      let key = key1;
      const value = obj[key];

      let containFieldPath = key.includes("$FieldPath$");
      key = key.replace("$FieldPath$", "");

      const xx = key.split("#FieldPath#");
      let fullKey = "";

      for (let i = 0; i < xx.length - 1; i++) {
        fullKey += escapeFieldName(xx[i]) + ".";
      }

      fullKey += containFieldPath
        ? escapeFieldName(xx[xx.length - 1])
        : xx[xx.length - 1];

      fullKey = prefix ? `${prefix}.${fullKey}` : fullKey;
      const wrappedKey = fullKey;

      const isFirstLevel = prefix === parentKey;

      // --------------------------------------------------
      // CASE 1: Object (map)
      // --------------------------------------------------
      if (
        typeof value === "object" &&
        value !== null &&
        !(value instanceof FieldValue) &&
        !(value instanceof Timestamp) &&
        !Array.isArray(value)
      ) {
        const hasFieldValue = containsFieldValueDeep(value);

        // ✅ FIRST LEVEL + NO FIELDVALUE → PUSH WHOLE OBJECT
        if (isFirstLevel && !hasFieldValue) {
          result.push({
            field: wrappedKey,
            value,
            op: "set",
            valueType: "mapValue",
          });
          continue;
        }

        // ✅ FIRST LEVEL + HAS FIELDVALUE → EMPTY MAP ONCE
        if (isFirstLevel && hasFieldValue && !seenParents.has(fullKey)) {
          seenParents.add(fullKey);
          result.push({
            field: wrappedKey,
            value: {},
            op: "set",
            valueType: "mapValue",
          });
        }

        // Only recurse if FieldValue exists
        if (hasFieldValue) {
          walk(value, fullKey);
        }

        continue;
      }

      // --------------------------------------
      // CASE 2: FieldValue operations
      // --------------------------------------
      if (value instanceof FieldValue) {
        let op = value.operation.replace("FieldValue:", "").trim();
        let val = value.value;

        // Fix naming
        if (op === "serverTimestamp") op = "servertimestamp";

        // ServerTimestamp -> separate bucket
        if (op === "servertimestamp" && merge) {
          query._serverTimestamp.push(fullKey);
          continue;
        }

        // Convert array ops into arrays
        if (op === "arrayUnion" || op === "arrayRemove") {
          if (!Array.isArray(val)) val = [val];
        }

        if (op === "delete") val = null;

        result.push({
          field: wrappedKey,
          value: val,
          op,
          valueType: identifyValueType(val),
        });

        continue;
      }

      // --------------------------------------
      // CASE 3: Normal primitive / array
      // --------------------------------------
      const valueType = identifyValueType(value);

      result.push({
        field: wrappedKey,
        value,
        op: "set",
        valueType: identifyValueType(value),
      });
    }
  }

  walk(input, parentKey);
  return result;
}

/**
 * Converts an update object into a flat array of update records for Oracledb v2.
 */
  /**
   * @internal
   */
export function serializeVersion2(
  query:any,
  input: any,
  merge: boolean,
  parentKey: string = ''
): Array<any> {
  const result: any[] = [];
  if (parentKey === '') {
    const { setMap, deleteKeys } = extractEmbeddingOps(input || {});
    if (Object.keys(setMap).length > 0) {
      result.push({ field: "$embeddings", value: setMap, op: "set", valueType: "mapValue" });
    }
    if (deleteKeys.length > 0) {
      result.push({ field: "$embeddings", value: deleteKeys, op: "delete", valueType: "arrayValue" });
    }
    input = Object.fromEntries(
      Object.entries(input || {}).filter(([k, v]) => !(k in setMap) && !(v instanceof FieldValue && v.operation === "FieldValue:deleteVector"))
    );
  }

  for (const key in input) {
    const value = input[key];
    let fullKey = parentKey ? `${parentKey}.${key}` : key;

    let containFieldPath = fullKey.includes("$FieldPath$");
    fullKey = fullKey.replace("$FieldPath$", "");
    let xx = fullKey.split("#FieldPath#");
    fullKey = "";
    for (let i = 0; i < xx.length - 1; i++) {
      fullKey += escapeFieldName(xx[i]) + ".";
    }
    if (containFieldPath) {
      fullKey += escapeFieldName(xx[xx.length - 1]);
    } else {
      fullKey += xx[xx.length - 1];
    }

    if (value === null) {
      result.push({
        field: fullKey,
        value: null,
        op: 'set',
        valueType: 'null'
      });
      continue;
    }

    if (value instanceof FieldValue) {
      let op = value.operation.replace('FieldValue:', '');
      if (op === "serverTimestamp") op = "servertimestamp";
      let val = value.value;
      if (op === "servertimestamp" && !merge) {
        query._serverTimestamp.push(fullKey);
      } else {
        if (op === 'arrayUnion' || op === 'arrayRemove') {
          if (!Array.isArray(val)) val = [val];
        }
        if (op === 'servertimestamp' || op === 'delete') val = null;

        result.push({
          field: fullKey,
          value: val,
          op,
          valueType: identifyValueType(val)
        });
      }

    } else if (value instanceof Timestamp) {
      let timestamp = value.toTimestampString();
      result.push({
        field: fullKey,
        value: timestamp,
        op: 'set',
        valueType: identifyValueType(timestamp)
      });
    } else if (typeof value === 'object' && !Array.isArray(value)) {
  
      if (Object.keys(value).length === 0) {
        result.push({
          field: fullKey,
          value: {},
          op: 'set',
          valueType: 'object'
        });
        continue;
      }

      const normalFields: Record<string, any> = {};
      const specialFields = [];

      for (const innerKey in value) {
        const innerValue = value[innerKey];
        if (innerValue instanceof FieldValue) {
          let op = innerValue.operation.replace('FieldValue:', '');
          let val = innerValue.value;

          if (op === 'arrayUnion' || op === 'arrayRemove') {
            if (!Array.isArray(val)) val = [val];
          }
          if (op === 'servertimestamp' || op === 'delete') val = null;

          specialFields.push({
            field: `${fullKey}.${innerKey}`,
            value: val,
            op,
            valueType: identifyValueType(val)
          });
        } else {
          normalFields[innerKey] = innerValue;
        }
      }

      if (Object.keys(normalFields).length > 0) {
        result.push({
          field: fullKey,
          value: normalFields,
          op: 'set',
          valueType: identifyValueType(normalFields)
        });
      }

      result.push(...specialFields);

    } else {
      result.push({
        field: fullKey,
        value,
        op: 'set',
        valueType: identifyValueType(value)
      });
    }
  }

  return result;
}

