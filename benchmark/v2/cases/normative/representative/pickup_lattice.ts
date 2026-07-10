import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "pickup_lattice",
  "title": "Pickup Lattice",
  "duration": 58,
  "provenance": {
    "kind": "reference_informed_manual",
    "authoring_brief": "A stable local pulse supports differently placed anticipations that always resolve, without sustained rapid contact streams."
  },
  "primary_family": "subdivision_pickup",
  "diagnostic_tags": [
    "pickup",
    "resolution",
    "high_speed"
  ],
  "pulse_regions": [
    {
      "start": 0.67,
      "end": 56.28,
      "pulse_seconds": 0.67,
      "intent": "stable lattice with bounded anticipations"
    }
  ],
  "phrases": {
    "late_pickup": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.72
      },
      {
        "offset": 0.67,
        "role": "support",
        "impact": 0.4
      },
      {
        "offset": 1.34,
        "role": "primary",
        "impact": 0.57
      },
      {
        "offset": 1.72,
        "role": "pickup",
        "impact": 0.3
      },
      {
        "offset": 2.01,
        "role": "accent",
        "impact": 0.88
      },
      {
        "offset": 2.68,
        "role": "support",
        "impact": 0.43
      },
      {
        "offset": 3.35,
        "role": "primary",
        "impact": 0.63
      },
      {
        "offset": 4.02,
        "role": "support",
        "impact": 0.36
      }
    ],
    "early_pickup": [
      {
        "offset": 0,
        "role": "reentry",
        "impact": 0.82
      },
      {
        "offset": 0.35,
        "role": "pickup",
        "impact": 0.28
      },
      {
        "offset": 0.67,
        "role": "primary",
        "impact": 0.76
      },
      {
        "offset": 1.34,
        "role": "support",
        "impact": 0.42
      },
      {
        "offset": 2.01,
        "role": "accent",
        "impact": 0.85
      },
      {
        "offset": 2.68,
        "role": "support",
        "impact": 0.39
      },
      {
        "offset": 3.35,
        "role": "primary",
        "impact": 0.6
      },
      {
        "offset": 4.02,
        "role": "support",
        "impact": 0.34
      }
    ],
    "double_answer": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.68
      },
      {
        "offset": 0.67,
        "role": "support",
        "impact": 0.38
      },
      {
        "offset": 1.06,
        "role": "pickup",
        "impact": 0.27
      },
      {
        "offset": 1.34,
        "role": "accent",
        "impact": 0.81
      },
      {
        "offset": 2.01,
        "role": "support",
        "impact": 0.44
      },
      {
        "offset": 2.39,
        "role": "pickup",
        "impact": 0.32
      },
      {
        "offset": 2.68,
        "role": "reentry",
        "impact": 0.91
      },
      {
        "offset": 3.35,
        "role": "primary",
        "impact": 0.59
      },
      {
        "offset": 4.02,
        "role": "support",
        "impact": 0.35
      }
    ]
  },
  "placements": [
    {
      "at": 0.67,
      "phrase": "late_pickup"
    },
    {
      "at": 5.36,
      "phrase": "early_pickup"
    },
    {
      "at": 10.05,
      "phrase": "late_pickup"
    },
    {
      "at": 14.74,
      "phrase": "double_answer"
    },
    {
      "at": 19.43,
      "phrase": "early_pickup"
    },
    {
      "at": 24.12,
      "phrase": "late_pickup"
    },
    {
      "at": 28.81,
      "phrase": "double_answer"
    },
    {
      "at": 33.5,
      "phrase": "late_pickup"
    },
    {
      "at": 38.19,
      "phrase": "early_pickup"
    },
    {
      "at": 42.88,
      "phrase": "double_answer"
    },
    {
      "at": 47.57,
      "phrase": "late_pickup"
    },
    {
      "at": 52.26,
      "phrase": "early_pickup"
    }
  ],
  "axes": {
    "air": [
      {
        "t": 0,
        "v": 0.36,
        "ease": "smooth",
        "intent": "lattice begins supported"
      },
      {
        "t": 12,
        "v": 0.52,
        "ease": "smooth",
        "intent": "pickups begin to open"
      },
      {
        "t": 28,
        "v": 0.64,
        "ease": "smooth",
        "intent": "middle answers have room"
      },
      {
        "t": 43,
        "v": 0.58,
        "ease": "smooth",
        "intent": "late lattice controlled"
      },
      {
        "t": 58,
        "v": 0.46,
        "intent": "supported finish"
      }
    ],
    "speed": [
      {
        "t": 0,
        "v": 0.78,
        "ease": "smooth",
        "intent": "already fast at first pickup"
      },
      {
        "t": 14,
        "v": 0.66,
        "ease": "smooth",
        "intent": "first answers demand control"
      },
      {
        "t": 31,
        "v": 0.9,
        "ease": "easeOut",
        "intent": "highest pickup pressure"
      },
      {
        "t": 45,
        "v": 0.74,
        "ease": "smooth",
        "intent": "late control"
      },
      {
        "t": 58,
        "v": 0.82,
        "intent": "finish with momentum"
      }
    ]
  },
  "start": {
    "vx": 4.5,
    "vy": 0,
    "y": -160
  },
  "preroll": 5,
  "jitter": 0,
  "phases": [
    {
      "id": "alternating_pickups",
      "start": 0,
      "end": 14.74,
      "intent": "alternating pickups"
    },
    {
      "id": "double_answers_one",
      "start": 14.74,
      "end": 28.81,
      "intent": "double answers one"
    },
    {
      "id": "double_answers_two",
      "start": 28.81,
      "end": 42.88,
      "intent": "double answers two"
    },
    {
      "id": "final_lattice",
      "start": 42.88,
      "end": 58,
      "intent": "final lattice"
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
