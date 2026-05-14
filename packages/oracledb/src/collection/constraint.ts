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

export abstract class QueryConstraint implements QueryConstraint {
  abstract readonly type: QueryConstraintType;
  // If needed, you can add constructor and methods in subclasses.
}

export class QueryCompositeFilterConstraint implements QueryCompositeFilterConstraint {
  readonly type: 'or' | 'and';
  /**
   * @internal
   */
  private readonly _queryCons: QueryConstraint[];
  constructor(type: 'or' | 'and', ...queryCons: QueryConstraint[]) {
    this.type = type;
    this._queryCons = [...queryCons];
  }
}


export class QueryEndAtConstraint extends QueryConstraint implements QueryEndAtConstraint {
  readonly type: 'endBefore' | 'endAt';
  /**
   * @internal
   */
  readonly __cons: any;
  constructor(type: 'endBefore' | 'endAt', cons: any) {
    super();
    this.type = type;
    this.__cons = cons;
  }
}

export class QueryFieldFilterConstraint extends QueryConstraint implements QueryFieldFilterConstraint {
  readonly type: QueryConstraintType;
  /**
   * @internal
   */
  readonly __cons: any;
  constructor(obj: any) {
    super();
    this.type = 'where';
    this.__cons = obj;
  }
}

export class QueryFieldJoinsConstraint extends QueryConstraint implements QueryFieldJoinsConstraint {
  readonly type: QueryConstraintType;
  /**
 * @internal
 */
  readonly __cons: any;
  constructor(obj: any) {
    super();
    this.type = 'join';
    this.__cons = obj;
  }
}

export class QueryLimitConstraint extends QueryConstraint implements QueryLimitConstraint {
  readonly type: 'limit' | 'limitToLast';
  /**
   * @internal
   */
  readonly __cons: any;
  constructor(type: 'limit' | 'limitToLast', lim: any) {
    super();
    this.type = type;
    this.__cons = lim;
  }
}

export class QueryOrderByConstraint extends QueryConstraint implements QueryOrderByConstraint {
  readonly type: QueryConstraintType;
  /**
   * @internal
   */
  readonly __cons: any;
  constructor(obj: any) {
    super();
    this.type = 'orderBy';
    this.__cons = obj;
  }
}


export class QueryStartAtConstraint extends QueryConstraint implements QueryStartAtConstraint {
  readonly type: 'startAt' | 'startAfter';
  /**
   * @internal
   */
  readonly __cons: any;
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