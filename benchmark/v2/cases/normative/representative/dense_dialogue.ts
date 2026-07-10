import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "dense_dialogue",
  "title": "Dense Dialogue",
  "duration": 58,
  "provenance": {
    "kind": "reference_informed_manual",
    "authoring_brief": "Sustained compact musical phrases alternate played 300-430ms gaps with short releases and a clear return to pulse."
  },
  "primary_family": "dense_musical",
  "diagnostic_tags": [
    "sustained_density",
    "played_microtiming",
    "release"
  ],
  "pulse_regions": [
    {
      "start": 0.64,
      "end": 22.4,
      "pulse_seconds": 0.38,
      "intent": "compact opening conversation"
    },
    {
      "start": 22.4,
      "end": 29.2,
      "pulse_seconds": 0.72,
      "intent": "breathing release"
    },
    {
      "start": 29.2,
      "end": 51.6,
      "pulse_seconds": 0.36,
      "intent": "denser returning dialogue"
    }
  ],
  "phrases": {
    "compact_a": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.72
      },
      {
        "offset": 0.38,
        "role": "support",
        "impact": 0.34
      },
      {
        "offset": 0.72,
        "role": "accent",
        "impact": 0.81
      },
      {
        "offset": 1.13,
        "role": "support",
        "impact": 0.29
      },
      {
        "offset": 1.49,
        "role": "primary",
        "impact": 0.58
      },
      {
        "offset": 1.82,
        "role": "pickup",
        "impact": 0.25
      },
      {
        "offset": 2.22,
        "role": "accent",
        "impact": 0.76
      },
      {
        "offset": 2.58,
        "role": "support",
        "impact": 0.38
      }
    ],
    "compact_b": [
      {
        "offset": 0,
        "role": "reentry",
        "impact": 0.88
      },
      {
        "offset": 0.32,
        "role": "support",
        "impact": 0.31
      },
      {
        "offset": 0.73,
        "role": "primary",
        "impact": 0.64
      },
      {
        "offset": 1.08,
        "role": "support",
        "impact": 0.27
      },
      {
        "offset": 1.51,
        "role": "accent",
        "impact": 0.84
      },
      {
        "offset": 1.86,
        "role": "pickup",
        "impact": 0.24
      },
      {
        "offset": 2.18,
        "role": "primary",
        "impact": 0.55
      },
      {
        "offset": 2.63,
        "role": "breath_exit",
        "impact": 0.69
      }
    ],
    "release": [
      {
        "offset": 0,
        "role": "accent",
        "impact": 0.78
      },
      {
        "offset": 0.72,
        "role": "support",
        "impact": 0.32
      },
      {
        "offset": 1.44,
        "role": "primary",
        "impact": 0.56
      },
      {
        "offset": 2.16,
        "role": "support",
        "impact": 0.28
      },
      {
        "offset": 3.24,
        "role": "breath_exit",
        "impact": 0.86
      },
      {
        "offset": 3.96,
        "role": "reentry",
        "impact": 0.62
      }
    ],
    "tail": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.62
      },
      {
        "offset": 0.44,
        "role": "support",
        "impact": 0.3
      },
      {
        "offset": 0.82,
        "role": "accent",
        "impact": 0.7
      },
      {
        "offset": 1.54,
        "role": "tail",
        "impact": 0.36
      },
      {
        "offset": 2.62,
        "role": "tail",
        "impact": 0.22
      },
      {
        "offset": 4.06,
        "role": "tail",
        "impact": 0.14
      }
    ]
  },
  "placements": [
    {
      "at": 0.64,
      "phrase": "compact_a"
    },
    {
      "at": 3.52,
      "phrase": "compact_b"
    },
    {
      "at": 6.4,
      "phrase": "compact_a"
    },
    {
      "at": 9.28,
      "phrase": "compact_b"
    },
    {
      "at": 12.16,
      "phrase": "compact_a"
    },
    {
      "at": 15.04,
      "phrase": "compact_b"
    },
    {
      "at": 17.92,
      "phrase": "compact_a"
    },
    {
      "at": 20.8,
      "phrase": "release"
    },
    {
      "at": 25.48,
      "phrase": "release"
    },
    {
      "at": 30.16,
      "phrase": "compact_b"
    },
    {
      "at": 33.04,
      "phrase": "compact_a"
    },
    {
      "at": 35.92,
      "phrase": "compact_b"
    },
    {
      "at": 38.8,
      "phrase": "compact_a"
    },
    {
      "at": 41.68,
      "phrase": "compact_b"
    },
    {
      "at": 44.56,
      "phrase": "compact_a"
    },
    {
      "at": 47.44,
      "phrase": "compact_b"
    },
    {
      "at": 50.32,
      "phrase": "tail"
    }
  ],
  "axes": {
    "air": [
      {
        "t": 0,
        "v": 0.46,
        "ease": "smooth",
        "intent": "supported compact entry"
      },
      {
        "t": 15,
        "v": 0.58,
        "ease": "smooth",
        "intent": "dialogue opens modestly"
      },
      {
        "t": 22.4,
        "v": 0.66,
        "ease": "easeOut",
        "intent": "release gets room"
      },
      {
        "t": 29.2,
        "v": 0.42,
        "ease": "smooth",
        "intent": "dense reentry stays supported"
      },
      {
        "t": 45,
        "v": 0.55,
        "ease": "smooth",
        "intent": "late phrase lifts"
      },
      {
        "t": 58,
        "v": 0.38,
        "intent": "tail settles"
      }
    ],
    "speed": [
      {
        "t": 0,
        "v": 0.58,
        "ease": "smooth",
        "intent": "controlled density"
      },
      {
        "t": 18,
        "v": 0.82,
        "ease": "smooth",
        "intent": "opening drive"
      },
      {
        "t": 25,
        "v": 0.66,
        "ease": "smooth",
        "intent": "release relaxes"
      },
      {
        "t": 39,
        "v": 0.9,
        "ease": "easeOut",
        "intent": "return drives hardest"
      },
      {
        "t": 58,
        "v": 0.64,
        "intent": "tail decelerates"
      }
    ]
  },
  "preroll": 5,
  "jitter": 0,
  "phases": [
    {
      "id": "compact_exchange_one",
      "start": 0,
      "end": 12.16,
      "intent": "compact exchange one"
    },
    {
      "id": "compact_exchange_two",
      "start": 12.16,
      "end": 22.4,
      "intent": "compact exchange two"
    },
    {
      "id": "breathing_release",
      "start": 22.4,
      "end": 29.2,
      "intent": "breathing release"
    },
    {
      "id": "dense_return_one",
      "start": 29.2,
      "end": 41.68,
      "intent": "dense return one"
    },
    {
      "id": "dense_return_two",
      "start": 41.68,
      "end": 51.6,
      "intent": "dense return two"
    },
    {
      "id": "tail",
      "start": 51.6,
      "end": 58,
      "intent": "tail"
    }
  ]
} as const satisfies BenchmarkScoreDocument;

export const benchmarkCase = defineScoreCase({
  metadata: {
  "cohort": "representative",
  "musicBacked": false,
  "eligibleComponents": [
    "sync",
    "survival",
    "air",
    "speed",
    "impact"
  ],
  "diagnosticComponents": []
},
  document: scoreDocument,
});

export default benchmarkCase.spec;
