import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

export function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function relativeToCwd(path: string): string {
  const cwd = `${process.cwd()}/`;
  return path.startsWith(cwd) ? path.slice(cwd.length) : path;
}

export function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function argumentReader(argv: string[]): (name: string) => string | undefined {
  return (name: string): string | undefined => {
    const prefix = `--${name}=`;
    return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
  };
}
