export type ContinuousSupportCurveCliArguments = {
  fixturePath: string;
  explicitOut: string | undefined;
};

/** The assay accepts only immutable inputs; action and phase controls are source-declared. */
export function parseContinuousSupportCurveCliArguments(
  argv: readonly string[],
): ContinuousSupportCurveCliArguments {
  const fixtureValues = values(argv, "fixture");
  const outValues = values(argv, "out");
  const unsupported = argv.filter((value) =>
    !value.startsWith("--fixture=") && !value.startsWith("--out="));
  if (unsupported.length > 0) throw new Error(`unsupported continuous support curve control(s): ${unsupported.join(", ")}`);
  if (fixtureValues.length !== 1 || fixtureValues[0] === "") {
    throw new Error("--fixture=FILE is required exactly once and must be non-empty");
  }
  if (outValues.length > 1 || outValues.some((value) => value === "")) {
    throw new Error("--out=FILE may be supplied once and must be non-empty");
  }
  return { fixturePath: fixtureValues[0]!, explicitOut: outValues[0] };
}

function values(argv: readonly string[], name: string): string[] {
  return argv.flatMap((value) => value.startsWith(`--${name}=`) ? [value.slice(name.length + 3)] : []);
}
