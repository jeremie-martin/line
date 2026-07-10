import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "high_air_drive",
  "title": "High Air Drive",
  "duration": 60,
  "provenance": {
    "kind": "reference_informed_manual",
    "authoring_brief": "A forceful ordinary pulse sustains high airborne intent while speed and impact move independently through two energy crests."
  },
  "primary_family": "high_air_energy",
  "diagnostic_tags": [
    "high_air",
    "energy_crest",
    "impact_contrast"
  ],
  "pulse_regions": [
    {
      "start": 0.58,
      "end": 51.62,
      "pulse_seconds": 0.58,
      "intent": "stable pulse supporting high-air motion"
    }
  ],
  "phrases": {
    "lift": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.68
      },
      {
        "offset": 0.58,
        "role": "support",
        "impact": 0.24
      },
      {
        "offset": 1.16,
        "role": "accent",
        "impact": 0.86
      },
      {
        "offset": 1.74,
        "role": "support",
        "impact": 0.32
      },
      {
        "offset": 2.32,
        "role": "primary",
        "impact": 0.61
      },
      {
        "offset": 2.9,
        "role": "support",
        "impact": 0.27
      },
      {
        "offset": 3.48,
        "role": "accent",
        "impact": 0.78
      },
      {
        "offset": 4.06,
        "role": "support",
        "impact": 0.35
      }
    ],
    "crest": [
      {
        "offset": 0,
        "role": "reentry",
        "impact": 0.94
      },
      {
        "offset": 0.58,
        "role": "support",
        "impact": 0.3
      },
      {
        "offset": 1.16,
        "role": "primary",
        "impact": 0.73
      },
      {
        "offset": 1.74,
        "role": "support",
        "impact": 0.22
      },
      {
        "offset": 2.32,
        "role": "accent",
        "impact": 0.91
      },
      {
        "offset": 2.9,
        "role": "support",
        "impact": 0.38
      },
      {
        "offset": 3.48,
        "role": "primary",
        "impact": 0.66
      },
      {
        "offset": 4.06,
        "role": "breath_exit",
        "impact": 0.82
      }
    ],
    "tail": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.64
      },
      {
        "offset": 0.58,
        "role": "support",
        "impact": 0.28
      },
      {
        "offset": 1.16,
        "role": "accent",
        "impact": 0.72
      },
      {
        "offset": 2.32,
        "role": "tail",
        "impact": 0.31
      },
      {
        "offset": 3.48,
        "role": "tail",
        "impact": 0.2
      },
      {
        "offset": 5.22,
        "role": "tail",
        "impact": 0.11
      }
    ]
  },
  "placements": [
    {
      "at": 0.58,
      "phrase": "lift"
    },
    {
      "at": 5.22,
      "phrase": "lift"
    },
    {
      "at": 9.86,
      "phrase": "crest"
    },
    {
      "at": 14.5,
      "phrase": "lift"
    },
    {
      "at": 19.14,
      "phrase": "crest"
    },
    {
      "at": 23.78,
      "phrase": "lift"
    },
    {
      "at": 28.42,
      "phrase": "lift"
    },
    {
      "at": 33.06,
      "phrase": "crest"
    },
    {
      "at": 37.7,
      "phrase": "lift"
    },
    {
      "at": 42.34,
      "phrase": "crest"
    },
    {
      "at": 46.98,
      "phrase": "lift"
    },
    {
      "at": 51.62,
      "phrase": "tail"
    }
  ],
  "axes": {
    "air": [
      {
        "t": 0,
        "v": 0.66,
        "ease": "smooth",
        "intent": "already airborne"
      },
      {
        "t": 10,
        "v": 0.82,
        "ease": "smooth",
        "intent": "first sustained lift"
      },
      {
        "t": 21,
        "v": 0.88,
        "ease": "easeOut",
        "intent": "first crest"
      },
      {
        "t": 30,
        "v": 0.72,
        "ease": "smooth",
        "intent": "middle breath"
      },
      {
        "t": 43,
        "v": 0.9,
        "ease": "smooth",
        "intent": "highest late crest"
      },
      {
        "t": 60,
        "v": 0.7,
        "intent": "floating release"
      }
    ],
    "speed": [
      {
        "t": 0,
        "v": 0.42,
        "ease": "smooth",
        "intent": "measured high-air entry"
      },
      {
        "t": 16,
        "v": 0.78,
        "ease": "smooth",
        "intent": "first drive"
      },
      {
        "t": 25,
        "v": 0.58,
        "ease": "smooth",
        "intent": "air stays high while speed drops"
      },
      {
        "t": 43,
        "v": 0.91,
        "ease": "easeOut",
        "intent": "late energy crest"
      },
      {
        "t": 60,
        "v": 0.52,
        "intent": "release"
      }
    ]
  },
  "preroll": 5,
  "jitter": 0,
  "phases": [
    {
      "id": "lift_opening",
      "start": 0,
      "end": 9.86,
      "intent": "lift opening"
    },
    {
      "id": "first_crest",
      "start": 9.86,
      "end": 23.78,
      "intent": "first crest"
    },
    {
      "id": "middle_breath",
      "start": 23.78,
      "end": 33.06,
      "intent": "middle breath"
    },
    {
      "id": "late_crest",
      "start": 33.06,
      "end": 46.98,
      "intent": "late crest"
    },
    {
      "id": "floating_release",
      "start": 46.98,
      "end": 60,
      "intent": "floating release"
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
