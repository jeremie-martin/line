/** Convert one generated independent-reference report into its small live
 * certification declaration. The source report remains local evidence; the
 * declaration is the reviewable contract input. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  certificationDeclarationSha256,
  compactCertificationDeclaration,
} from "../v0/benchmark_v2/certification_declaration.ts";
import { writeFileAtomicDurable } from "../v0/benchmark_v2/durable_fs.ts";

const input = argument("in");
const output = argument("out");
if (input === undefined || output === undefined) {
  throw new Error(`usage: node --import tsx scripts/benchmark/compact_certification.ts --in=REPORT.json --out=DECLARATION.json`);
}
const cells = argument("cells")?.split(",").filter(Boolean);
for (const value of process.argv.slice(2)) {
  if (!value.startsWith("--in=") && !value.startsWith("--out=") && !value.startsWith("--cells=")) {
    throw new Error(`unsupported compact-certification argument ${value}`);
  }
}
const source = readFileSync(resolve(input));
const declaration = compactCertificationDeclaration(
  JSON.parse(source.toString("utf8")),
  certificationDeclarationSha256(source),
  cells,
);
writeFileAtomicDurable(resolve(output), `${JSON.stringify(declaration, null, 2)}\n`);

function argument(name: string): string | undefined {
  return process.argv.slice(2).find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}
