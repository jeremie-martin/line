/**
 * verse_chorus — 24s, ~30 contacts spread across 8 short blocks (song
 * structure: verse-chorus-verse-chorus with bridge). Disambiguates whether
 * runtime cost is driven by block count vs contact count — current suite
 * has counts bunched in 3-4.
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";

// dynamics follow the song form: soft verses, hard choruses (alternating 3s
// blocks) — landings get loud on the hook and back off in the verse.
const contacts: Contact[] = [];
for (let t = 0.55; t < 24; t += 0.78) {
  const isChorus = Math.floor(t / 3) % 2 === 1; // [3,6),[9,12),[15,18),[21,24)
  contacts.push({ t: Number(t.toFixed(3)), impact: isChorus ? 0.85 : 0.3 });
}

const spec: Spec = {
  duration: 24,
  contacts,
  axes: {
    air: keyframes(
      [
        { t: 0, v: 0.45 }, { t: 3, v: 0.60 }, { t: 6, v: 0.50 }, { t: 9, v: 0.65 },
        { t: 12, v: 0.50 }, { t: 15, v: 0.60 }, { t: 18, v: 0.55 }, { t: 21, v: 0.62 },
      ],
      "hold",
    ),
    speed: keyframes(
      [
        { t: 0, v: 0.55 }, { t: 3, v: 0.68 }, { t: 6, v: 0.60 }, { t: 9, v: 0.72 },
        { t: 12, v: 0.55 }, { t: 15, v: 0.70 }, { t: 18, v: 0.62 }, { t: 21, v: 0.68 },
      ],
      "hold",
    ),
    grain: keyframes(
      [
        { t: 0, v: 0.50 }, { t: 3, v: 0.55 }, { t: 6, v: 0.45 }, { t: 9, v: 0.60 },
        { t: 12, v: 0.50 }, { t: 15, v: 0.55 }, { t: 18, v: 0.50 }, { t: 21, v: 0.58 },
      ],
      "hold",
    ),
  },
  preroll: 5,
};

export default spec;
