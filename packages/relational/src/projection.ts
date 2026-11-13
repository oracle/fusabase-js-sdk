// Copyright (c) 2015, 2026, Oracle and/or its affiliates.

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

/** A selected column, optionally renamed with PostgREST's `alias:column` syntax. */
export type ProjectionColumn = string | { column: string; alias: string };

/** An aggregate selected by a PostgREST-style projection. */
export type ProjectionAggregate = {
  function: "count" | "sum" | "avg" | "min" | "max";
  column?: string;
  alias?: string;
};

/** A related table selected by a PostgREST-style projection. */
export type ProjectionRelation = {
  table: string;
  alias?: string;
  hint?: string;
  joinType: "left" | "inner";
  spread?: true;
  relationCount?: true;
  projection?: Projection;
};

/** The BAAS projection envelope generated from a Relational `select()` string. */
export type Projection = {
  all: boolean;
  columns: ProjectionColumn[];
  aggregates: ProjectionAggregate[];
  relations: ProjectionRelation[];
};

/** Raised when a `select()` projection does not follow the supported syntax. */
export class ProjectionSyntaxError extends SyntaxError {
  constructor(message: string, readonly position: number) {
    super(`${message} at position ${position}`);
    this.name = "ProjectionSyntaxError";
  }
}

const AGGREGATE_FUNCTIONS = new Set<ProjectionAggregate["function"]>([
  "count",
  "sum",
  "avg",
  "min",
  "max",
]);

/** Parses the PostgREST-style selection accepted by Relational's `select()` API. */
export function parseProjection(source = "*"): Projection {
  return new ProjectionReader(source).parse();
}

class ProjectionReader {
  private offset = 0;

  constructor(private readonly source: string) {}

  parse(): Projection {
    const projection = this.readProjection(false);
    this.skipWhitespace();
    if (!this.atEnd()) this.fail(`Unexpected '${this.peek()}'`);
    return projection;
  }

  private readProjection(nested: boolean): Projection {
    const projection: Projection = { all: false, columns: [], aggregates: [], relations: [] };
    this.skipWhitespace();

    if (this.peek() === ")" || this.atEnd()) return projection;

    while (true) {
      this.readItem(projection, nested);
      this.skipWhitespace();
      if (this.peek() !== ",") break;
      this.offset += 1;
      this.skipWhitespace();
      if (this.peek() === ")" || this.atEnd()) this.fail("Expected a projection item");
    }
    return projection;
  }

  private readItem(projection: Projection, nested: boolean): void {
    const spread = this.consume("...");
    const tokenStart = this.offset;
    const token = this.readToken();
    if (!token) this.fail("Expected a projection item", tokenStart);

    this.skipWhitespace();
    if (this.peek() !== "(") {
      if (spread) this.fail("A spread operator must select a relation", tokenStart);
      if (token === "*") {
        projection.all = true;
        return;
      }
      if (nested && token === "count") {
        projection.relations.push({ table: "count", joinType: "left", relationCount: true });
        return;
      }
      projection.columns.push(this.parseColumn(token, tokenStart));
      return;
    }

    this.offset += 1;
    const childProjection = this.readProjection(true);
    this.skipWhitespace();
    if (this.peek() !== ")") this.fail("Expected ')' to close relation");
    this.offset += 1;

    const aggregate = this.parseAggregate(token);
    if (aggregate) {
      if (spread) this.fail("A spread operator cannot select an aggregate", tokenStart);
      projection.aggregates.push(aggregate);
      return;
    }

    const relation = this.parseRelation(token, tokenStart);
    if (spread) relation.spread = true;
    if (this.isRelationCount(childProjection)) {
      relation.relationCount = true;
    } else {
      relation.projection = childProjection;
    }
    projection.relations.push(relation);
  }

  private parseColumn(token: string, position: number): ProjectionColumn {
    const { alias, value } = this.splitAlias(token, position);
    if (!value) this.fail("Expected a column name", position);
    return alias ? { column: value, alias } : value;
  }

  private parseAggregate(token: string): ProjectionAggregate | undefined {
    const { alias, value } = this.splitAlias(token, this.offset - token.length);
    const match = /^(?:(.+)\.)?(count|sum|avg|min|max)$/.exec(value);
    if (!match) return undefined;

    const [, column, functionName] = match;
    const aggregate: ProjectionAggregate = {
      function: functionName as ProjectionAggregate["function"],
    };
    if (column) aggregate.column = column;
    if (alias) aggregate.alias = alias;
    return aggregate;
  }

  private parseRelation(token: string, position: number): ProjectionRelation {
    const { alias, value } = this.splitAlias(token, position);
    const parts = value.split("!");
    const table = parts.shift();
    if (!table) this.fail("Expected a relation name", position);

    let hint: string | undefined;
    let joinType: "left" | "inner" = "left";
    for (const modifier of parts) {
      if (!modifier) this.fail("Expected a relation modifier", position);
      if (modifier === "inner") {
        joinType = "inner";
      } else if (!hint) {
        hint = modifier;
      } else {
        this.fail(`Unsupported relation modifier '${modifier}'`, position);
      }
    }

    const relation: ProjectionRelation = { table, joinType };
    if (alias) relation.alias = alias;
    if (hint) relation.hint = hint;
    return relation;
  }

  private splitAlias(token: string, position: number): { alias?: string; value: string } {
    const parts = token.split(":");
    if (parts.length > 2 || !parts[0] || !parts.at(-1)) {
      this.fail(`Invalid projection identifier '${token}'`, position);
    }
    return parts.length === 2 ? { alias: parts[0], value: parts[1] } : { value: token };
  }

  private readToken(): string {
    let value = "";
    let quoted = false;
    while (!this.atEnd()) {
      const char = this.peek();
      if (char === '"') quoted = !quoted;
      if (!quoted && (char === "(" || char === ")" || char === ",")) break;
      if (!quoted && /\s/.test(char)) {
        this.offset += 1;
        continue;
      }
      value += char;
      this.offset += 1;
    }
    if (quoted) this.fail("Unterminated quoted identifier");
    return value;
  }

  private isEmpty(projection: Projection): boolean {
    return !projection.all && !projection.columns.length && !projection.aggregates.length && !projection.relations.length;
  }

  private isRelationCount(projection: Projection): boolean {
    return (
      projection.relations.length === 1 &&
      projection.relations[0].table === "count" &&
      projection.relations[0].relationCount === true &&
      this.isEmpty({ ...projection, relations: [] })
    );
  }

  private consume(value: string): boolean {
    if (!this.source.startsWith(value, this.offset)) return false;
    this.offset += value.length;
    return true;
  }

  private skipWhitespace(): void {
    while (!this.atEnd() && /\s/.test(this.peek())) this.offset += 1;
  }

  private peek(): string {
    return this.source[this.offset] ?? "";
  }

  private atEnd(): boolean {
    return this.offset >= this.source.length;
  }

  private fail(message: string, position = this.offset): never {
    throw new ProjectionSyntaxError(message, position);
  }
}
