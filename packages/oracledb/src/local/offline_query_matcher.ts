// Copyright (c) 2015, 2025, Oracle and/or its affiliates.

//-----------------------------------------------------------------------------
//
// This software is dual-licensed to you under the Universal Permissive License
// (UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl and Apache License
// 2.0 as shown at http://www.apache.org/licenses/LICENSE-2.0. You may choose
// either license.
//
// If you elect to accept the software under the Apache License, Version 2.0,
// the following applies:
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
//-----------------------------------------------------------------------------
// 

import { Utils } from '../util/utils.js';

export type OfflineQueryFilter = { field: string | null; op: string; value: any };

export function matchesQueryFilters(
  data: Record<string, unknown> | null,
  conditions: OfflineQueryFilter[] = []
): boolean {
  if (conditions.some(condition => condition.field == null)) {
    return false;
  }
  return conditions.every(condition => matchesCondition(data, condition));
}

export function getFieldValue(data: Record<string, unknown> | null, fieldPath: string): any {
  if (fieldPath.includes('#FieldPath#')) {
    return Utils.getObjectProperty(data, fieldPath);
  }
  return fieldPath.split('.').reduce<any>((value, key) => value == null ? undefined : value[key], data);
}

function matchesCondition(
  data: Record<string, unknown> | null,
  condition: OfflineQueryFilter
): boolean {
  if (!condition.field) return true;
  const actual = getFieldValue(data, condition.field);
  switch (condition.op) {
    case '=':
    case '==':
      return actual === condition.value;
    case '!=':
      return actual !== condition.value;
    case '<':
      return actual < condition.value;
    case '<=':
      return actual <= condition.value;
    case '>':
      return actual > condition.value;
    case '>=':
      return actual >= condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(actual);
    case 'not in':
    case 'not-in':
      return Array.isArray(condition.value) && !condition.value.includes(actual);
    case 'array-contains':
      return Array.isArray(actual) && actual.includes(condition.value);
    case 'array-contains-any':
      return Array.isArray(actual) &&
        Array.isArray(condition.value) &&
        condition.value.some((value: unknown) => actual.includes(value));
    case 'is NULL':
    case 'is-null':
      return actual == null;
    case 'like':
      return typeof actual === 'string' &&
        likePatternToRegExp(String(condition.value)).test(actual);
    default:
      return false;
  }
}

function likePatternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/%/g, '.*').replace(/_/g, '.')}$`);
}
