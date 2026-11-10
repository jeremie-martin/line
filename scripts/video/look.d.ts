// Types of look.js (a plain module, so the browser loads it as is). The options and their values are defined once, in look.js;
// resolveLook checks every option and value, so a look that reaches TypeScript code is a complete, checked one. No TypeScript
// code reads a single option: a look is passed through, to the picture.
/** A complete look: every option of look.js OPTIONS with one of its values, as resolveLook returns it. */
export type Look = {readonly [option: string]: string};
/** Some options of a look (a theme's choices, PLAIN). */
export type LookChoices = {readonly [option: string]: string};
export const OPTIONS: {readonly [option: string]: readonly [label: string, values: {readonly [value: string]: string}]};
export const V1: Look;
export const THEMES: {readonly [name: string]: {name: string; id: string; line: string; look: LookChoices}};
export const DEFAULT_THEME: string;
export const PLAIN: LookChoices;
export function resolveLook(name?: string | null, overrides?: Record<string, string>): Look;
