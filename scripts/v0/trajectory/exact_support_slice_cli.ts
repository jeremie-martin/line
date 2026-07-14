/** Strict, testable CLI contract for the exact-support-slice study. */
export function parseExactSupportSliceCliArguments(argv: readonly string[]): {
  fixturePath: string;
  explicitOut: string | undefined;
} {
  const values = new Map<string, string>();
  for (const value of argv) {
    const option = ["fixture", "out"].find((name) => value.startsWith(`--${name}=`));
    if (option === undefined) throw new Error(`unsupported exact-support-slice control: ${value}`);
    const parsed = value.slice(option.length + 3);
    if (parsed.length === 0) throw new Error(`--${option}= requires a non-empty value`);
    if (values.has(option)) throw new Error(`--${option}= may be provided only once`);
    values.set(option, parsed);
  }
  const fixturePath = values.get("fixture");
  if (fixturePath === undefined) throw new Error("--fixture=FILE is required");
  return { fixturePath, explicitOut: values.get("out") };
}
