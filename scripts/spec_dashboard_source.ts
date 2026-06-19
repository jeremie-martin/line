import { readFileSync, writeFileSync } from "node:fs";
import * as ts from "typescript";

export type SpecDashboardEditKind = "axisKeyframe" | "zoomKeyframe" | "contactImpact";

export type SpecDashboardEditMeta = {
  editable: boolean;
  editKind: SpecDashboardEditKind | null;
  id: string | null;
  readOnlyReason?: string;
};

export type SpecDashboardSourceEntry = {
  id: string;
  kind: SpecDashboardEditKind;
  index: number;
  axis?: string;
  t: number;
  value: number;
  ease: string | null;
  tRange: TextRange;
  valueRange: TextRange;
  easeRange: TextRange | null;
  easePropertyRange: TextRange | null;
  insertEaseAt: number | null;
};

export type SpecDashboardSourceIndex = {
  axisKeyframes: Map<string, SpecDashboardSourceEntry>;
  zoomKeyframes: Map<number, SpecDashboardSourceEntry>;
  contactImpacts: Map<number, SpecDashboardSourceEntry>;
  byId: Map<string, SpecDashboardSourceEntry>;
};

export type ApplySpecDashboardEditInput = {
  editKind: SpecDashboardEditKind;
  id: string;
  t?: number | null;
  value?: number | null;
  impact?: number | null;
  ease?: string | null;
};

type TextRange = {
  start: number;
  end: number;
};

type Replacement = TextRange & {
  text: string;
};

const AXIS_NAMES = new Set(["air", "speed", "grain", "elevation", "amplitude", "impact"]);
const EASE_VALUES = new Set(["hold", "linear", "smooth", "easeIn", "easeOut"]);

export function editableMeta(entry: SpecDashboardSourceEntry | undefined, readOnlyReason: string): SpecDashboardEditMeta {
  if (!entry) return { editable: false, editKind: null, id: null, readOnlyReason };
  return { editable: true, editKind: entry.kind, id: entry.id };
}

export function readSpecDashboardSourceIndex(absPath: string): SpecDashboardSourceIndex {
  return buildSpecDashboardSourceIndex(readFileSync(absPath, "utf8"));
}

export function buildSpecDashboardSourceIndex(sourceText: string): SpecDashboardSourceIndex {
  const sf = ts.createSourceFile("spec.ts", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const variableKeyframes = new Map<string, ts.CallExpression>();
  const variableArrays = new Map<string, ts.ArrayLiteralExpression>();

  const collectVariables = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (isKeyframesCall(node.initializer)) {
        variableKeyframes.set(node.name.text, node.initializer);
      } else if (ts.isArrayLiteralExpression(node.initializer)) {
        variableArrays.set(node.name.text, node.initializer);
      }
    }
    ts.forEachChild(node, collectVariables);
  };
  collectVariables(sf);

  const axisKeyframes = new Map<string, SpecDashboardSourceEntry>();
  const zoomKeyframes = new Map<number, SpecDashboardSourceEntry>();
  const contactImpacts = new Map<number, SpecDashboardSourceEntry>();
  const byId = new Map<string, SpecDashboardSourceEntry>();
  let contactLiteralIndex = 0;

  const addEntry = (entry: SpecDashboardSourceEntry): void => {
    byId.set(entry.id, entry);
    if (entry.kind === "axisKeyframe" && entry.axis) axisKeyframes.set(`${entry.axis}:${entry.index}`, entry);
    if (entry.kind === "zoomKeyframe") zoomKeyframes.set(entry.index, entry);
    if (entry.kind === "contactImpact") contactImpacts.set(entry.index, entry);
  };

  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const axesObj = objectPropertyObject(node, "axes");
      if (axesObj) {
        for (const prop of axesObj.properties) {
          const axis = propertyAxisName(prop);
          if (!axis) continue;
          const call = axisKeyframesCall(prop, variableKeyframes);
          if (!call) continue;
          for (const entry of entriesFromKeyframesCall(sourceText, sf, call, "axisKeyframe", axis)) addEntry(entry);
        }
      }

      const zoomObj = objectPropertyObject(node, "zoom");
      const zoomPoints = zoomObj ? objectPropertyArray(zoomObj, "keyframes") : null;
      if (zoomPoints) {
        for (const entry of entriesFromArray(sourceText, sf, zoomPoints, "zoomKeyframe", "zoom")) addEntry(entry);
      }

      // Only count contact literals that live in the spec's `contacts:` array (inline or
      // via a `const contacts = [...]` reference). Scanning every array literal file-wide
      // would let a stray { t } object elsewhere shift the index and misattribute edits.
      const contactsArray = contactsArrayFor(node, variableArrays);
      if (contactsArray) {
        for (const element of contactsArray.elements) {
          if (!ts.isObjectLiteralExpression(element)) continue;
          if (!isContactLikeObject(element)) continue;
          const index = contactLiteralIndex;
          contactLiteralIndex++;
          const entry = entryFromObject(sourceText, sf, element, "contactImpact", "impact", index);
          if (!entry) continue;
          addEntry(entry);
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sf);

  return { axisKeyframes, zoomKeyframes, contactImpacts, byId };
}

export function applySpecDashboardEdit(absPath: string, input: ApplySpecDashboardEditInput): SpecDashboardSourceEntry {
  const sourceText = readFileSync(absPath, "utf8");
  const index = buildSpecDashboardSourceIndex(sourceText);
  const entry = index.byId.get(input.id);
  if (!entry || entry.kind !== input.editKind) {
    throw new Error("edit target is no longer available or editable");
  }

  const replacements: Replacement[] = [];
  if (entry.kind === "axisKeyframe") {
    const t = finiteNumber(input.t, "time");
    const value = clamp(finiteNumber(input.value, "value"), 0, 1);
    replacements.push({ ...entry.tRange, text: formatNumber(Math.max(0, t)) });
    replacements.push({ ...entry.valueRange, text: formatNumber(value) });
    applyEaseReplacement(sourceText, entry, input.ease ?? null, replacements);
  } else if (entry.kind === "zoomKeyframe") {
    const t = finiteNumber(input.t, "time");
    const value = finiteNumber(input.value, "zoom");
    if (value <= 0) throw new Error("zoom must be greater than 0");
    replacements.push({ ...entry.tRange, text: formatNumber(Math.max(0, t)) });
    replacements.push({ ...entry.valueRange, text: formatNumber(value) });
  } else {
    const impact = clamp(finiteNumber(input.impact, "impact"), 0, 1);
    replacements.push({ ...entry.valueRange, text: formatNumber(impact) });
  }

  const next = applyReplacements(sourceText, replacements);
  writeFileSync(absPath, next);
  return entry;
}

function entriesFromKeyframesCall(
  sourceText: string,
  sf: ts.SourceFile,
  call: ts.CallExpression,
  kind: "axisKeyframe",
  axis: string,
): SpecDashboardSourceEntry[] {
  const first = call.arguments[0];
  if (!first || !ts.isArrayLiteralExpression(first)) return [];
  return entriesFromArray(sourceText, sf, first, kind, "v", axis);
}

function entriesFromArray(
  sourceText: string,
  sf: ts.SourceFile,
  array: ts.ArrayLiteralExpression,
  kind: "axisKeyframe" | "zoomKeyframe",
  valueProp: "v" | "zoom",
  axis?: string,
): SpecDashboardSourceEntry[] {
  const out: SpecDashboardSourceEntry[] = [];
  let index = 0;
  for (const element of array.elements) {
    if (!ts.isObjectLiteralExpression(element)) continue;
    const entry = entryFromObject(sourceText, sf, element, kind, valueProp, index, axis);
    if (entry) out.push(entry);
    index++;
  }
  return out;
}

function entryFromObject(
  sourceText: string,
  sf: ts.SourceFile,
  object: ts.ObjectLiteralExpression,
  kind: SpecDashboardEditKind,
  valueProp: "v" | "zoom" | "impact",
  index: number,
  axis?: string,
): SpecDashboardSourceEntry | null {
  const tProp = propertyAssignment(object, "t");
  const valueNodeProp = propertyAssignment(object, valueProp);
  if (!tProp || !valueNodeProp) return null;
  const t = numericInitializer(tProp.initializer);
  const value = numericInitializer(valueNodeProp.initializer);
  if (t === null || value === null) return null;

  const easeProp = propertyAssignment(object, "ease");
  const ease = easeProp && ts.isStringLiteralLike(easeProp.initializer) ? easeProp.initializer.text : null;
  const id = kind === "axisKeyframe"
    ? `axis:${axis}:${index}`
    : kind === "zoomKeyframe"
      ? `zoom:${index}`
      : `contact:${index}`;

  return {
    id,
    kind,
    index,
    axis,
    t,
    value,
    ease,
    tRange: nodeRange(sf, tProp.initializer),
    valueRange: nodeRange(sf, valueNodeProp.initializer),
    easeRange: easeProp ? nodeRange(sf, easeProp.initializer) : null,
    easePropertyRange: easeProp ? propertyRemovalRange(sourceText, sf, object, easeProp) : null,
    insertEaseAt: easeProp ? null : objectInsertEnd(sourceText, object),
  };
}

function applyEaseReplacement(
  sourceText: string,
  entry: SpecDashboardSourceEntry,
  ease: string | null,
  replacements: Replacement[],
): void {
  if (ease !== null && ease !== "") {
    if (!EASE_VALUES.has(ease)) throw new Error(`unsupported ease: ${ease}`);
    if (entry.easeRange) {
      replacements.push({ ...entry.easeRange, text: JSON.stringify(ease) });
      return;
    }
    if (entry.insertEaseAt === null) throw new Error("cannot add ease to this keyframe");
    const insertText = sourceText.slice(entry.insertEaseAt - 1, entry.insertEaseAt).trim() === ","
      ? ` ease: ${JSON.stringify(ease)}`
      : `, ease: ${JSON.stringify(ease)}`;
    replacements.push({ start: entry.insertEaseAt, end: entry.insertEaseAt, text: insertText });
    return;
  }

  if (entry.easePropertyRange) replacements.push({ ...entry.easePropertyRange, text: "" });
}

function propertyRemovalRange(
  sourceText: string,
  sf: ts.SourceFile,
  object: ts.ObjectLiteralExpression,
  prop: ts.PropertyAssignment,
): TextRange {
  const start = prop.getFullStart();
  const end = prop.getEnd();
  const after = sourceText.slice(end);
  const followingComma = /^\s*,/.exec(after);
  if (followingComma) return { start, end: end + followingComma[0].length };

  const before = sourceText.slice(object.getStart(sf), start);
  const commaIndex = before.lastIndexOf(",");
  if (commaIndex >= 0) {
    return { start: object.getStart(sf) + commaIndex, end };
  }
  return { start, end };
}

function objectInsertEnd(sourceText: string, object: ts.ObjectLiteralExpression): number {
  let pos = object.getEnd() - 1;
  while (pos > object.getStart() && /\s/.test(sourceText[pos - 1] ?? "")) pos--;
  return pos;
}

function axisKeyframesCall(
  prop: ts.ObjectLiteralElementLike,
  variableKeyframes: Map<string, ts.CallExpression>,
): ts.CallExpression | null {
  if (ts.isShorthandPropertyAssignment(prop)) {
    return variableKeyframes.get(prop.name.text) ?? null;
  }
  if (!ts.isPropertyAssignment(prop)) return null;
  if (isKeyframesCall(prop.initializer)) return prop.initializer;
  if (ts.isIdentifier(prop.initializer)) return variableKeyframes.get(prop.initializer.text) ?? null;
  return null;
}

function propertyAxisName(prop: ts.ObjectLiteralElementLike): string | null {
  if (ts.isShorthandPropertyAssignment(prop)) return AXIS_NAMES.has(prop.name.text) ? prop.name.text : null;
  if (!ts.isPropertyAssignment(prop)) return null;
  const name = propertyNameText(prop.name);
  return name && AXIS_NAMES.has(name) ? name : null;
}

function objectPropertyObject(object: ts.ObjectLiteralExpression, name: string): ts.ObjectLiteralExpression | null {
  const prop = propertyAssignment(object, name);
  return prop && ts.isObjectLiteralExpression(prop.initializer) ? prop.initializer : null;
}

function objectPropertyArray(object: ts.ObjectLiteralExpression, name: string): ts.ArrayLiteralExpression | null {
  const prop = propertyAssignment(object, name);
  return prop && ts.isArrayLiteralExpression(prop.initializer) ? prop.initializer : null;
}

/** The array literal backing a spec's `contacts` property — an inline `contacts: [...]`,
 *  an identifier reference `contacts: c`, or the `{ contacts }` shorthand resolved through a
 *  `const contacts = [...]` declaration. Returns null when contacts are generated by a call
 *  (beats(), withImpact(), …), which have no editable source literals. */
function contactsArrayFor(
  object: ts.ObjectLiteralExpression,
  variableArrays: ReadonlyMap<string, ts.ArrayLiteralExpression>,
): ts.ArrayLiteralExpression | null {
  for (const prop of object.properties) {
    if (ts.isPropertyAssignment(prop) && propertyNameText(prop.name) === "contacts") {
      if (ts.isArrayLiteralExpression(prop.initializer)) return prop.initializer;
      if (ts.isIdentifier(prop.initializer)) return variableArrays.get(prop.initializer.text) ?? null;
      return null;
    }
    if (ts.isShorthandPropertyAssignment(prop) && prop.name.text === "contacts") {
      return variableArrays.get(prop.name.text) ?? null;
    }
  }
  return null;
}

function propertyAssignment(object: ts.ObjectLiteralExpression, name: string): ts.PropertyAssignment | null {
  for (const prop of object.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    if (propertyNameText(prop.name) === name) return prop;
  }
  return null;
}

function isContactLikeObject(object: ts.ObjectLiteralExpression): boolean {
  const tProp = propertyAssignment(object, "t");
  if (!tProp || numericInitializer(tProp.initializer) === null) return false;
  return !propertyAssignment(object, "v") && !propertyAssignment(object, "zoom");
}

function propertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function isKeyframesCall(node: ts.Node): node is ts.CallExpression {
  return ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "keyframes";
}

function numericInitializer(node: ts.Expression): number | null {
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return -Number(node.operand.text);
  }
  return null;
}

function nodeRange(sf: ts.SourceFile, node: ts.Node): TextRange {
  return { start: node.getStart(sf), end: node.getEnd() };
}

function finiteNumber(value: unknown, name: string): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) throw new Error(`${name} must be a finite number`);
  return n;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error("cannot format non-finite number");
  return value.toFixed(4).replace(/\.?0+$/, "");
}

function applyReplacements(sourceText: string, replacements: Replacement[]): string {
  const ordered = [...replacements].sort((a, b) => b.start - a.start);
  let next = sourceText;
  for (const replacement of ordered) {
    next = next.slice(0, replacement.start) + replacement.text + next.slice(replacement.end);
  }
  return next;
}
