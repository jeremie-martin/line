import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {sha,type Case} from '../v4/model.ts';
import type {ProductionPlan} from '../../scripts/v0/optimizer/repertoire_policy.ts';
export type RepertoireCase={id:string;sourceId:string;panel:'fixed'|'automatic';family:string;split:'canonical'|'confirmation';
  layout?:'paired'|'transfer';plans:Record<number,ProductionPlan>;scoredSections:Record<number,number[]>};
export type Catalog={schema:'line.benchmark-v6.catalog.v1';music:Case[];cases:RepertoireCase[]};
export function loadCatalog():Catalog{
  const raw=gunzipSync(readFileSync(new URL('./catalog.json.gz',import.meta.url)));
  const lock=JSON.parse(readFileSync(new URL('./catalog.lock.json',import.meta.url),'utf8'));
  if(sha(raw)!==lock.sha256)throw new Error('V6 catalog checksum mismatch');
  return JSON.parse(raw.toString());
}
