/**
 * A song's measured events (productions/<song>/events.json, from tools/music/events.py)
 * as authoring helpers for its music.ts: look up the event at an authored time, read
 * an instrument's loudness, derive a strength, and merge layers into landing times.
 * See docs/music-authoring.md.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type Source = { t: number; peak: number; rise: number; classes?: string[] };
export type MusicEvent = { t: number; sources: Record<string, Source>; mix: { peak: number; rise: number } };

/** A sung note from tools/music/sung.py (productions/<song>/sung.json). */
export type SungNote = { t: number; salience: number; pitch?: string; event: { t: number; stems: string[] } | null };

export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Helpers over the events and tempo analysis in a song's folder. */
export function measuredSong(dir: string) {
  const events = (JSON.parse(readFileSync(resolve(dir, "events.json"), "utf8")) as { events: MusicEvent[] }).events;
  const audio = JSON.parse(readFileSync(resolve(dir, "audio.json"), "utf8")) as {
    tempo: { librosa_bpm: number | null; madmom_bpm?: number | null };
  };

  /** The measured event at an authored time (within 30 ms). */
  function event(t: number): MusicEvent {
    if (!events.length) throw new Error(`no measured events in ${resolve(dir, "events.json")}: rerun tools/music/events.py`);
    const e = events.reduce((best, x) => (Math.abs(x.t - t) < Math.abs(best.t - t) ? x : best));
    if (Math.abs(e.t - t) > 0.03) throw new Error(`no measured event at ${t}`);
    return e;
  }
  const rise = (t: number, source: string) => event(t).sources[source]?.rise ?? 0;
  const drumPeak = (t: number) => event(t).sources.drums?.peak ?? 0;
  /** A drum hit's measured loudness carries to strength. */
  const drumStrength = (t: number, scale = 0.9) => clamp(scale * drumPeak(t), 0.2, 1);
  /** A syllable or chord entry: gentle, by how sharply it enters. */
  const voiceStrength = (t: number, base = 0.04, gain = 0.4) =>
    clamp(base + gain * Math.max(rise(t, "vocals"), rise(t, "other")), 0.04, 0.5);

  /** Merge layers into authored contact times: measured event times, sorted, without duplicates. */
  function landings(...layers: number[][]): number[] {
    const times = [...new Set(layers.flat().map((t) => Number(event(t).t.toFixed(3))))].sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++)
      if (times[i] - times[i - 1] < 0.15) throw new Error(`landings ${times[i - 1]} and ${times[i]} are too close`);
    return times;
  }

  /** Sung notes at least `minSalience`, as their events.json times (notes with no event are left out). */
  function sungNotes(minSalience = 0): number[] {
    const path = resolve(dir, "sung.json");
    if (!existsSync(path)) throw new Error(`no sung.json in ${dir}: run tools/music/sung.py`);
    const notes = (JSON.parse(readFileSync(path, "utf8")) as { notes: SungNote[] }).notes;
    return notes.filter((n) => n.salience >= minSalience && n.event).map((n) => Number(n.event!.t.toFixed(2)));
  }

  return { events, audio, event, rise, drumPeak, drumStrength, voiceStrength, landings, sungNotes };
}
