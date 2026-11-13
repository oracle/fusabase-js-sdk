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
import {QueryConstraintType} from '../types/common.js';
import { VectorSearch } from '../types/vector.js';

/** Base class for a query constraint. @example `const constraint = where("done", "==", false);` */
export abstract class QueryConstraint implements QueryConstraint {
/** Describes the public `type` value. */
  abstract readonly type: QueryConstraintType;
  // If needed, you can add constructor and methods in subclasses.
}

/** Groups filter constraints into a composite expression. @example `const constraint = new QueryCompositeFilterConstraint([]);` */
export class QueryCompositeFilterConstraint implements QueryCompositeFilterConstraint {
/** Describes the public `type` value. */
  readonly type: 'or' | 'and';
  /**
   * @internal
   */
  private readonly _queryCons: QueryConstraint[];
/**
 * Constructs a QueryCompositeFilterConstraint instance with the supplied configuration.
 *
 * @param type - The type accepted by this operation.
 * @param queryCons - The queryCons accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { QueryCompositeFilterConstraint } from "fusabase/oracledb";
 * const result = new QueryCompositeFilterConstraint("and");
 * void result;
 * ```
 */
  constructor(type: 'or' | 'and', ...queryCons: QueryConstraint[]) {
    this.type = type;
    this._queryCons = [...queryCons];
  }
}


/** Represents an ending cursor constraint. @example `const constraint = endAt("task-9");` */
export class QueryEndAtConstraint extends QueryConstraint implements QueryEndAtConstraint {
/** Describes the public `type` value. */
  readonly type: 'endBefore' | 'endAt';
  /**
   * @internal
   */
  readonly __cons: any;
/**
 * Constructs a QueryEndAtConstraint instance with the supplied configuration.
 *
 * @param type - The type accepted by this operation.
 * @param cons - The cons accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { QueryEndAtConstraint } from "fusabase/oracledb";
 * const result = new QueryEndAtConstraint("endAt", ["task-9"]);
 * void result;
 * ```
 */
  constructor(type: 'endBefore' | 'endAt', cons: any) {
    super();
    this.type = type;
    this.__cons = cons;
  }
}

/** Represents a field-filter constraint. @example `const constraint = where("done", "==", false);` */
export class QueryFieldFilterConstraint extends QueryConstraint implements QueryFieldFilterConstraint {
/** Describes the public `type` value. */
  readonly type: QueryConstraintType;
  /**
   * @internal
   */
  readonly __cons: any;
/**
 * Constructs a QueryFieldFilterConstraint instance with the supplied configuration.
 *
 * @param obj - The obj accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { QueryFieldFilterConstraint } from "fusabase/oracledb";
 * const result = new QueryFieldFilterConstraint({ fieldPath: "done", opStr: "==", value: false });
 * void result;
 * ```
 */
  constructor(obj: any) {
    super();
    this.type = 'where';
    this.__cons = obj;
  }
}

/** Represents a view-join constraint. @example `const constraint = join("task_details");` */
export class QueryFieldJoinsConstraint extends QueryConstraint implements QueryFieldJoinsConstraint {
/** Describes the public `type` value. */
  readonly type: QueryConstraintType;
  /**
 * @internal
 */
  readonly __cons: any;
/**
 * Constructs a QueryFieldJoinsConstraint instance with the supplied configuration.
 *
 * @param obj - The obj accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { QueryFieldJoinsConstraint } from "fusabase/oracledb";
 * const result = new QueryFieldJoinsConstraint({ fieldPath: "task_details" });
 * void result;
 * ```
 */
  constructor(obj: any) {
    super();
    this.type = 'join';
    this.__cons = obj;
  }
}

/** Represents a result-limit constraint. @example `const constraint = limit(10);` */
export class QueryLimitConstraint extends QueryConstraint implements QueryLimitConstraint {
/** Describes the public `type` value. */
  readonly type: 'limit' | 'limitToLast';
  /**
   * @internal
   */
  readonly __cons: any;
/**
 * Constructs a QueryLimitConstraint instance with the supplied configuration.
 *
 * @param type - The type accepted by this operation.
 * @param lim - The lim accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { QueryLimitConstraint } from "fusabase/oracledb";
 * const result = new QueryLimitConstraint("limit", 10);
 * void result;
 * ```
 */
  constructor(type: 'limit' | 'limitToLast', lim: any) {
    super();
    this.type = type;
    this.__cons = lim;
  }
}

/** Represents a sort-order constraint. @example `const constraint = orderBy("createdAt", "desc");` */
export class QueryOrderByConstraint extends QueryConstraint implements QueryOrderByConstraint {
/** Describes the public `type` value. */
  readonly type: QueryConstraintType;
  /**
   * @internal
   */
  readonly __cons: any;
/**
 * Constructs a QueryOrderByConstraint instance with the supplied configuration.
 *
 * @param obj - The obj accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { QueryOrderByConstraint } from "fusabase/oracledb";
 * const result = new QueryOrderByConstraint({ fieldPath: "createdAt", directionStr: "desc" });
 * void result;
 * ```
 */
  constructor(obj: any) {
    super();
    this.type = 'orderBy';
    this.__cons = obj;
  }
}


/** Represents a starting cursor constraint. @example `const constraint = startAt("task-1");` */
export class QueryStartAtConstraint extends QueryConstraint implements QueryStartAtConstraint {
/** Describes the public `type` value. */
  readonly type: 'startAt' | 'startAfter';
  /**
   * @internal
   */
  readonly __cons: any;
/**
 * Constructs a QueryStartAtConstraint instance with the supplied configuration.
 *
 * @param type - The type accepted by this operation.
 * @param cons - The cons accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { QueryStartAtConstraint } from "fusabase/oracledb";
 * const result = new QueryStartAtConstraint("startAt", ["task-1"]);
 * void result;
 * ```
 */
  constructor(type: 'startAt' | 'startAfter', cons: any) {
    super();
    this.type = type;
    this.__cons = cons;
  }
}

export class QueryVectorSearchConstraint extends QueryConstraint implements QueryVectorSearchConstraint {
  readonly type: 'vectorSearch';
  /**
   * @internal
   */
  readonly __cons: VectorSearch;
  constructor(cons: VectorSearch) {
    super();
    this.type = 'vectorSearch';
    this.__cons = cons;
  }
}
