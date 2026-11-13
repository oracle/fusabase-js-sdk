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

export enum LogicalOperator {
  and = "and",
  or = "or",
}

export enum Operator {
  eq = "eq",
  gte = "gte",
  gt = "gt",
  lte = "lte",
  lt = "lt",
  neq = "neq",
  like = "like",
  ilike = "ilike",
  in = "in",
  is = "is",
  fts = "fts",
  plfts = "plfts",
  phfts = "phfts",
  wfts = "wfts",
  cs = "cs",
  cd = "cd",
  ov = "ov",
  sl = "sl",
  sr = "sr",
  nxr = "nxr",
  nxl = "nxl",
  adj = "adj",
  not = "not",
}

export type Primitive = string | number | boolean | null;
export type Operand = Primitive | Primitive[] | Range<Primitive>;

/** A predicate accepted in the BAAS `qbe.$query` tree. */
export type BaasQueryPredicate = Record<string, unknown>;

/** Filter portion of the BAAS request envelope. */
export interface BaasQbe {
  $query: BaasQueryPredicate;
}

export interface Condition {
  ident?: string;
  negated: boolean;
  operator: Operator;
  value: Operand;
}

export interface LogicalCondition {
  negated: boolean;
  operator: LogicalOperator;
  value: Filter[];
}

export type Filter = Condition | LogicalCondition;

export interface Including<T> {
  kind: "including";
  value: T;
}

export interface Excluding<T> {
  kind: "excluding";
  value: T;
}

export interface Range<T> {
  left: Including<T> | Excluding<T>;
  right: Including<T> | Excluding<T>;
}

const OPERATORS = new Set<string>(Object.values(Operator));
const LOGICAL_OPERATORS = new Set<string>(Object.values(LogicalOperator));
const IDENTIFIER = /^[A-Za-z_][A-Za-z_0-9]*$/;
const JSON_PATH_PART = /^[A-Za-z_0-9-]+$/;
const COLUMN_REFERENCE = /^[A-Za-z_][A-Za-z_0-9]*(?:(?:->>?)[A-Za-z_0-9-]+)*$/;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

const FILTER_OPERATOR_ALIASES: Record<string, string> = {
  eq: "$eq",
  ne: "$ne",
  neq: "$ne",
  gt: "$gt",
  ge: "$gte",
  gte: "$gte",
  lt: "$lt",
  le: "$lte",
  lte: "$lte",
  in: "$in",
  nin: "$nin",
  between: "$between",
  instr: "$instr",
  ninstr: "$ninstr",
  like: "$like",
  ilike: "$ilike",
  null: "$exists",
  notnull: "$exists",
  exists: "$exists",
  cs: "$all",
  all: "$all",
  regex: "$regex",
  likeRegex: "$likeRegex",
  ciRegex: "$ciRegex",
  ciLikeRegex: "$ciLikeRegex",
  nlRegex: "$nlRegex",
  nlLikeRegex: "$nlLikeRegex",
  nlciRegex: "$nlciRegex",
  nlciLikeRegex: "$nlciLikeRegex",
  hasSubstring: "$hasSubstring",
  startsWith: "$startsWith",
  ov: "$overlaps",
  overlaps: "$overlaps",
  adj: "$adjacent",
  adjacent: "$adjacent",
  sr: "$gt",
  nxl: "$gte",
  sl: "$lt",
  nxr: "$lte",
  bitsAllSet: "$bitsAllSet",
  bitsAllClear: "$bitsAllClear",
  bitsAnySet: "$bitsAnySet",
  bitsAnyClear: "$bitsAnyClear",
};

const NEGATED_FILTER_OPERATORS: Record<string, string> = {
  $eq: "$ne",
  $ne: "$eq",
  $gt: "$lte",
  $gte: "$lt",
  $lt: "$gte",
  $lte: "$gt",
  $in: "$nin",
  $nin: "$in",
  $instr: "$ninstr",
  $ninstr: "$instr",
  $null: "$notnull",
  $notnull: "$null",
};

const COLLECTION_FILTER_OPERATORS = new Set(["$in", "$nin", "$all"]);
const BLOCKED_FILTER_OPERATORS = new Set([
  "contains",
  "sqlJson",
  "near",
  "within",
  "intersects",
]);

/** Raised when a filter expression is not valid. */
export class FilterSyntaxError extends SyntaxError {
  readonly position: number;

  constructor(message: string, position: number) {
    super(`${message} at position ${position}`);
    this.name = "FilterSyntaxError";
    this.position = position;
  }
}

export function isLogicalCondition(filter: Filter): filter is LogicalCondition {
  return LOGICAL_OPERATORS.has(filter.operator);
}

class FilterReader {
  private offset = 0;

  constructor(private readonly source: string) {}

  parseFilter(): Filter {
    this.skipWhitespace();
    const negated = this.consume("not.");

    if (this.isLogicalExpression()) {
      return this.readLogicalCondition(negated);
    }

    return this.readCondition(negated);
  }

  parseCondition(): Condition {
    this.skipWhitespace();
    const negated = this.consume("not.");
    return this.readCondition(negated);
  }

  parseLogicalCondition(): LogicalCondition {
    this.skipWhitespace();
    const negated = this.consume("not.");
    if (!this.isLogicalExpression()) {
      this.fail("Expected a logical expression");
    }
    return this.readLogicalCondition(negated);
  }

  parsePrimitive(): Primitive {
    this.skipWhitespace();
    const value = this.peek() === '"' ? this.readQuotedString() : this.readBareValue();
    this.skipWhitespace();
    return value;
  }

  parseArray(): Primitive[] {
    this.skipWhitespace();
    const opening = this.peek();
    if (opening !== "{" && opening !== "(") {
      this.fail("Expected a collection");
    }
    return this.readCollection(opening, opening === "{" ? "}" : ")");
  }

  parseRange(): Range<Primitive> {
    this.skipWhitespace();
    return this.readRange();
  }

  finish<T>(value: T): T {
    this.skipWhitespace();
    if (!this.atEnd()) {
      this.fail(`Unexpected '${this.peek()}'`);
    }
    return value;
  }

  private readCondition(initialNegation: boolean): Condition {
    let negated = initialNegation;
    let token = this.readColumnToken();
    this.expect(".");

    let ident: string | undefined;
    if (!OPERATORS.has(token)) {
      if (!COLUMN_REFERENCE.test(token)) {
        this.fail(`Invalid identifier '${token}'`, this.offset - token.length - 1);
      }
      ident = token;

      if (this.consume("not.")) {
        negated = true;
      }

      token = this.readWord("operator");
      this.expect(".");
    }

    if (!OPERATORS.has(token) || token === Operator.not) {
      this.fail(`Unknown operator '${token}'`, this.offset - token.length - 1);
    }

    const operator = token as Operator;
    const value = this.readOperand(operator);
    return ident === undefined
      ? { negated, operator, value }
      : { ident, negated, operator, value };
  }

  private readLogicalCondition(negated: boolean): LogicalCondition {
    const operator = this.readWord("logical operator") as LogicalOperator;
    this.expect("(");
    this.skipWhitespace();

    const value: Filter[] = [];
    if (this.consume(")")) {
      return { negated, operator, value };
    }

    while (true) {
      value.push(this.parseFilter());
      this.skipWhitespace();

      if (this.consume(")")) break;
      this.expect(",");
      this.skipWhitespace();
    }

    return { negated, operator, value };
  }

  private readOperand(operator: Operator): Operand {
    this.skipWhitespace();
    const next = this.peek();

    if (next === "{") return this.readCollection("{", "}");
    if (next === "[") return this.readRange();
    if (next === "(") {
      return operator === Operator.in
        ? this.readCollection("(", ")")
        : this.readRange();
    }

    return this.parsePrimitive();
  }

  private readCollection(opening: "{" | "(", closing: "}" | ")"): Primitive[] {
    this.expect(opening);
    this.skipWhitespace();

    const values: Primitive[] = [];
    if (this.consume(closing)) return values;

    while (true) {
      values.push(this.parsePrimitive());
      if (this.consume(closing)) return values;
      this.expect(",");
      this.skipWhitespace();
    }
  }

  private readRange(): Range<Primitive> {
    const opening = this.peek();
    if (opening !== "(" && opening !== "[") {
      this.fail("Expected a range");
    }
    this.offset += 1;

    const left = this.parsePrimitive();
    this.expect(",");
    const right = this.parsePrimitive();
    const closing = this.peek();
    if (closing !== ")" && closing !== "]") {
      this.fail("Expected ')' or ']' to close the range");
    }
    this.offset += 1;

    return {
      left: {
        kind: opening === "[" ? "including" : "excluding",
        value: left,
      },
      right: {
        kind: closing === "]" ? "including" : "excluding",
        value: right,
      },
    };
  }

  private readQuotedString(): string {
    this.expect('"');
    const start = this.offset;

    while (!this.atEnd() && this.peek() !== '"') {
      this.offset += 1;
    }
    if (this.atEnd()) this.fail("Unterminated quoted string", start - 1);

    const value = this.source.slice(start, this.offset);
    this.offset += 1;
    return value;
  }

  private readBareValue(): Primitive {
    const start = this.offset;
    while (!this.atEnd() && !/[\s,.:(){}\[\]]/.test(this.peek())) {
      this.offset += 1;
    }

    if (start === this.offset) this.fail("Expected a value");
    const value = this.source.slice(start, this.offset);
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    return NUMBER.test(value) ? Number(value) : value;
  }

  private readWord(label: string): string {
    const start = this.offset;
    while (!this.atEnd() && /[A-Za-z_0-9]/.test(this.peek())) {
      this.offset += 1;
    }
    if (start === this.offset) this.fail(`Expected ${label}`);
    return this.source.slice(start, this.offset);
  }

  private readColumnToken(): string {
    const start = this.offset;
    while (!this.atEnd() && this.peek() !== ".") this.offset += 1;
    if (start === this.offset) this.fail("Expected operator or identifier");
    return this.source.slice(start, this.offset);
  }

  private isLogicalExpression(): boolean {
    for (const operator of LOGICAL_OPERATORS) {
      if (this.source.startsWith(`${operator}(`, this.offset)) return true;
    }
    return false;
  }

  private skipWhitespace(): void {
    while (!this.atEnd() && /\s/.test(this.peek())) this.offset += 1;
  }

  private consume(value: string): boolean {
    if (!this.source.startsWith(value, this.offset)) return false;
    this.offset += value.length;
    return true;
  }

  private expect(value: string): void {
    if (!this.consume(value)) this.fail(`Expected '${value}'`);
  }

  private peek(): string {
    return this.source[this.offset] ?? "";
  }

  private atEnd(): boolean {
    return this.offset >= this.source.length;
  }

  private fail(message: string, position = this.offset): never {
    throw new FilterSyntaxError(message, position);
  }
}

function parseWith<T>(input: string, parse: (reader: FilterReader) => T): T {
  const reader = new FilterReader(input);
  return reader.finish(parse(reader));
}

function normalizeFilterOperator(operator: string): string {
  const rawOperator = operator.startsWith("$") ? operator.slice(1) : operator;
  if (BLOCKED_FILTER_OPERATORS.has(rawOperator)) {
    throw new FilterSyntaxError(
      `Operator '${operator}' is blocked by the BAAS QBE v1 grammar`,
      0
    );
  }

  const normalized = FILTER_OPERATOR_ALIASES[rawOperator];
  if (!normalized) {
    throw new FilterSyntaxError(
      `Operator '${operator}' is not supported by the BAAS QBE grammar`,
      0
    );
  }
  return normalized;
}

function normalizeFilterValue(operator: string, value: unknown): unknown {
  if (!COLLECTION_FILTER_OPERATORS.has(operator) || typeof value !== "string") {
    return value;
  }

  const collection = value.trim();
  if (
    (collection.startsWith("(") && collection.endsWith(")")) ||
    (collection.startsWith("{") && collection.endsWith("}"))
  ) {
    return parseArray(collection);
  }

  throw new FilterSyntaxError(
    `Operator '${operator}' expects an array or a PostgREST collection string`,
    0
  );
}

export interface ColumnReference {
  column: string;
  path: string[];
}

/** Splits `DOC->status->check` into BAAS column/path parts. */
export function parseColumnReference(reference: string): ColumnReference {
  const source = reference.trim();
  const parts = source.includes("->") ? source.split(/->>?/) : source.split(".");
  const [column, ...path] = parts;

  if (
    !column ||
    !IDENTIFIER.test(column) ||
    path.some((part) => !part || !JSON_PATH_PART.test(part))
  ) {
    throw new FilterSyntaxError(`Invalid column or JSON path '${reference}'`, 0);
  }
  return { column, path };
}

/** Nests an operator leaf below the JSON path encoded in a column reference. */
export function createColumnPredicate(
  reference: string,
  leaf: Record<string, unknown>
): BaasQueryPredicate {
  const { column, path } = parseColumnReference(reference);
  let nested: Record<string, unknown> = leaf;
  for (let index = path.length - 1; index >= 0; index -= 1) {
    nested = { [path[index]]: nested };
  }
  return { [column]: nested };
}

/**
 * Builds one BAAS QBE leaf from raw `filter()` or `not()` arguments.
 * Operator aliases are normalized here; target-specific validation remains a
 * server responsibility because only server metadata knows the column type.
 */
export function createFilterPredicate(
  column: string,
  operator: string,
  value: unknown,
  negated = false
): BaasQueryPredicate {
  if (!column || column.trim() === "") {
    throw new FilterSyntaxError("A column identifier is required for a BAAS predicate", 0);
  }

  const rawOperator = operator.startsWith("$") ? operator.slice(1) : operator;
  if (rawOperator === "is") {
    const isValue = typeof value === "string"
      ? value === "null"
        ? null
        : value === "true"
          ? true
          : value === "false"
            ? false
            : value
      : value;

    if (isValue === null) {
      // ORDS interprets `$exists: false` as a SQL NULL check.
      return createColumnPredicate(column, { $exists: negated });
    }
    if (typeof isValue !== "boolean") {
      throw new FilterSyntaxError("The 'is' operator only accepts true, false, or null", 0);
    }
    return createColumnPredicate(column, { [negated ? "$ne" : "$eq"]: isValue });
  }

  if (rawOperator === "null" || rawOperator === "notnull") {
    return createColumnPredicate(column, {
      // ORDS uses `$exists: false` for NULL and `$exists: true` for NOT NULL.
      $exists: rawOperator === "notnull" ? !negated : negated,
    });
  }

  let normalizedOperator = normalizeFilterOperator(operator);
  let normalizedValue = normalizeFilterValue(normalizedOperator, value);

  if (normalizedOperator === "$exists") {
    if (typeof normalizedValue !== "boolean") {
      throw new FilterSyntaxError("The '$exists' operator expects a boolean value", 0);
    }
    if (negated) normalizedValue = !normalizedValue;
    return createColumnPredicate(column, { $exists: normalizedValue });
  }

  if (negated) {
    const inverse = NEGATED_FILTER_OPERATORS[normalizedOperator];
    if (inverse) normalizedOperator = inverse;
    else {
      return createColumnPredicate(column, {
        $not: { [normalizedOperator]: normalizedValue },
      });
    }
  }

  return createColumnPredicate(column, { [normalizedOperator]: normalizedValue });
}

function translateCondition(condition: Condition, negated: boolean): BaasQueryPredicate {
  if (!condition.ident) {
    throw new FilterSyntaxError("A column identifier is required for a BAAS predicate", 0);
  }
  return createFilterPredicate(
    condition.ident,
    condition.operator,
    condition.value,
    negated
  );
}

function translateFilter(filter: Filter, inheritedNegation = false): BaasQueryPredicate {
  const negated = inheritedNegation !== filter.negated;

  if (!isLogicalCondition(filter)) {
    return translateCondition(filter, negated);
  }

  const logicalOperator = negated
    ? filter.operator === LogicalOperator.and
      ? "$or"
      : "$and"
    : `$${filter.operator}`;

  return {
    [logicalOperator]: filter.value.map((child) => translateFilter(child, negated)),
  };
}

export function parsePrimitive(input: string): Primitive {
  return parseWith(input, (reader) => reader.parsePrimitive());
}

export function parseRange(input: string): Range<Primitive> {
  return parseWith(input, (reader) => reader.parseRange());
}

export function parseArray(input: string): Primitive[] {
  return parseWith(input, (reader) => reader.parseArray());
}

export function parseCondition(input: string): BaasQueryPredicate {
  const condition = parseWith(input, (reader) => reader.parseCondition());
  return translateFilter(condition);
}

export function parseLogicExpr(input: string): BaasQueryPredicate {
  const condition = parseWith(input, (reader) => reader.parseLogicalCondition());
  return translateFilter(condition);
}

/** Parses a filter into the predicate shape accepted by `qbe.$query`. */
export function parseFilter(input: string): BaasQueryPredicate {
  const filter = parseWith(input, (reader) => reader.parseFilter());
  return translateFilter(filter);
}

/** Parses a filter and wraps it in the BAAS QBE request envelope. */
export function parseQbe(input: string): BaasQbe {
  return { $query: parseFilter(input) };
}

export default parseFilter;
