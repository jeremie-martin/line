// Types of timing.js (a plain module, so the browser loads it as is).
import type {Account, Timing} from './scene.ts';
export const FPS: number;
export const MAX_OFFSET: number;
export function rideTime(s: number, offset: number): number;
export function songTime(r: number, offset: number): number;
export function songTimeOfFrame(f: number, offset: number): number;
export function alignment(account: Account | null): Timing;
