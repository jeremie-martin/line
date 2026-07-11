export function latestSuccessfulResults<T extends { status: string }>(
  results: T[],
  key: (result: T) => string,
): T[] {
  const latest = new Map<string, T>();
  for (const result of results) latest.set(key(result), result);
  return [...latest.values()].filter((result) => result.status === "ok");
}
