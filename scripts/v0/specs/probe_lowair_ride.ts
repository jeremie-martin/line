import type { Contact, Spec } from "../types.ts";
import { constant } from "../core/curves.ts";
const contacts: Contact[] = [];
for (let t = 0.5; t < 14; t += 0.5) contacts.push({ t: Number(t.toFixed(3)) });
const spec: Spec = { duration: 15, contacts, jitter: 0, axes: { air: constant(0.12), speed: constant(0.5) } };
export default spec;
