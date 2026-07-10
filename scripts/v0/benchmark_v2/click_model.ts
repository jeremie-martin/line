import type { Spec } from "../types.ts";

const SAMPLE_RATE = 44_100;
const CLICK_SECONDS = 0.045;

export function encodeClickTrack(spec: Spec): Buffer {
  const sampleCount = Math.ceil((spec.duration + 0.25) * SAMPLE_RATE);
  const samples = new Float64Array(sampleCount);
  const clickSamples = Math.ceil(CLICK_SECONDS * SAMPLE_RATE);

  for (const contact of spec.contacts) {
    const start = Math.round(contact.t * SAMPLE_RATE);
    const impact = contact.impact ?? 0.5;
    const frequency = impact >= 0.8 ? 1760 : impact >= 0.55 ? 1200 : 820;
    const gain = 0.16 + 0.64 * Math.max(0, Math.min(1, impact));
    for (let i = 0; i < clickSamples && start + i < samples.length; i++) {
      const time = i / SAMPLE_RATE;
      const envelope = Math.exp(-time * 85);
      samples[start + i] += gain * envelope * Math.sin(2 * Math.PI * frequency * time);
    }
  }

  const pcmBytes = sampleCount * 2;
  const wav = Buffer.alloc(44 + pcmBytes);
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(36 + pcmBytes, 4);
  wav.write("WAVE", 8, "ascii");
  wav.write("fmt ", 12, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(pcmBytes, 40);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    wav.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return wav;
}
