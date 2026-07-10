import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "meter_exchange_speed_plus_4",
  "title": "Meter Exchange, Faster Drive",
  "duration": 60,
  "provenance": {
    "kind": "reference_informed_manual",
    "authoring_brief": "Compact and spacious local meters trade phrases before a short drive and broad final release. Variant: speed is shifted by 0.04 with clamping; rhythm and other authored axes remain fixed."
  },
  "primary_family": "cadence_transition",
  "diagnostic_tags": [
    "meter_exchange",
    "nonmonotonic_tempo",
    "target_continuity"
  ],
  "pulse_regions": [
    {
      "start": 0.58,
      "end": 31.54,
      "pulse_seconds": 0.64,
      "intent": "alternating 580ms and 710ms phrase meters"
    },
    {
      "start": 31.54,
      "end": 43.54,
      "pulse_seconds": 0.5,
      "intent": "brief compact drive"
    },
    {
      "start": 43.54,
      "end": 59.38,
      "pulse_seconds": 0.66,
      "intent": "broad release"
    }
  ],
  "phrases": {
    "compact": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.64
      },
      {
        "offset": 0.58,
        "role": "support",
        "impact": 0.35
      },
      {
        "offset": 1.16,
        "role": "accent",
        "impact": 0.73
      },
      {
        "offset": 1.74,
        "role": "support",
        "impact": 0.38
      },
      {
        "offset": 2.32,
        "role": "primary",
        "impact": 0.59
      },
      {
        "offset": 2.9,
        "role": "fill",
        "impact": 0.44
      },
      {
        "offset": 3.48,
        "role": "accent",
        "impact": 0.78
      },
      {
        "offset": 4.06,
        "role": "reentry",
        "impact": 0.82
      }
    ],
    "spacious": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.7
      },
      {
        "offset": 0.71,
        "role": "support",
        "impact": 0.31
      },
      {
        "offset": 1.42,
        "role": "accent",
        "impact": 0.76
      },
      {
        "offset": 2.13,
        "role": "support",
        "impact": 0.36
      },
      {
        "offset": 2.84,
        "role": "primary",
        "impact": 0.55
      },
      {
        "offset": 3.55,
        "role": "support",
        "impact": 0.28
      },
      {
        "offset": 4.26,
        "role": "accent",
        "impact": 0.67
      },
      {
        "offset": 4.97,
        "role": "breath_exit",
        "impact": 0.86
      }
    ],
    "drive": [
      {
        "offset": 0,
        "role": "accent",
        "impact": 0.84
      },
      {
        "offset": 0.5,
        "role": "support",
        "impact": 0.41
      },
      {
        "offset": 1,
        "role": "primary",
        "impact": 0.65
      },
      {
        "offset": 1.5,
        "role": "support",
        "impact": 0.37
      },
      {
        "offset": 2,
        "role": "accent",
        "impact": 0.89
      },
      {
        "offset": 2.5,
        "role": "support",
        "impact": 0.45
      },
      {
        "offset": 3,
        "role": "primary",
        "impact": 0.69
      },
      {
        "offset": 3.5,
        "role": "reentry",
        "impact": 0.92
      }
    ],
    "release": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.68
      },
      {
        "offset": 0.66,
        "role": "support",
        "impact": 0.34
      },
      {
        "offset": 1.32,
        "role": "accent",
        "impact": 0.71
      },
      {
        "offset": 1.98,
        "role": "support",
        "impact": 0.3
      },
      {
        "offset": 2.64,
        "role": "primary",
        "impact": 0.53
      },
      {
        "offset": 3.3,
        "role": "tail",
        "impact": 0.27
      },
      {
        "offset": 3.96,
        "role": "tail",
        "impact": 0.2
      },
      {
        "offset": 4.62,
        "role": "tail",
        "impact": 0.14
      }
    ]
  },
  "placements": [
    {
      "at": 0.58,
      "phrase": "compact"
    },
    {
      "at": 5.35,
      "phrase": "spacious"
    },
    {
      "at": 10.9,
      "phrase": "compact"
    },
    {
      "at": 15.67,
      "phrase": "spacious"
    },
    {
      "at": 21.22,
      "phrase": "compact"
    },
    {
      "at": 25.99,
      "phrase": "spacious"
    },
    {
      "at": 31.54,
      "phrase": "drive"
    },
    {
      "at": 35.54,
      "phrase": "drive"
    },
    {
      "at": 39.54,
      "phrase": "drive"
    },
    {
      "at": 43.54,
      "phrase": "release"
    },
    {
      "at": 48.82,
      "phrase": "release"
    },
    {
      "at": 54.1,
      "phrase": "release"
    }
  ],
  "axes": {
    "air": [
      {
        "t": 0,
        "v": 0.4,
        "ease": "smooth",
        "intent": "compact opening"
      },
      {
        "t": 10,
        "v": 0.64,
        "ease": "smooth",
        "intent": "spacious answer opens"
      },
      {
        "t": 24,
        "v": 0.54,
        "ease": "smooth",
        "intent": "exchange remains controlled"
      },
      {
        "t": 37,
        "v": 0.68,
        "ease": "smooth",
        "intent": "drive opens gradually"
      },
      {
        "t": 49,
        "v": 0.74,
        "ease": "smooth",
        "intent": "release has room"
      },
      {
        "t": 60,
        "v": 0.56,
        "intent": "finish"
      }
    ],
    "speed": [
      {
        "t": 0,
        "v": 0.74,
        "ease": "smooth",
        "intent": "first compact exchange moves"
      },
      {
        "t": 16,
        "v": 0.56,
        "ease": "smooth",
        "intent": "spacious meter releases"
      },
      {
        "t": 31.54,
        "v": 0.86,
        "ease": "smooth",
        "intent": "drive enters"
      },
      {
        "t": 41,
        "v": 0.7,
        "ease": "easeOut",
        "intent": "compact crest stays controlled"
      },
      {
        "t": 49,
        "v": 0.82,
        "ease": "smooth",
        "intent": "release regains motion"
      },
      {
        "t": 60,
        "v": 0.56,
        "intent": "finish"
      }
    ]
  },
  "preroll": 5,
  "jitter": 0,
  "phases": [
    {
      "id": "compact_spacious_one",
      "start": 0,
      "end": 15.67,
      "intent": "compact spacious one"
    },
    {
      "id": "compact_spacious_two",
      "start": 15.67,
      "end": 31.54,
      "intent": "compact spacious two"
    },
    {
      "id": "compact_drive",
      "start": 31.54,
      "end": 43.54,
      "intent": "compact drive"
    },
    {
      "id": "broad_release",
      "start": 43.54,
      "end": 60,
      "intent": "broad release"
    }
  ]
} satisfies BenchmarkScoreDocument;

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
  "diagnosticComponents": [],
  "id": "meter_exchange_speed_plus_4",
  "title": "Meter Exchange, Faster Drive",
  "originFamily": "cadence_transition",
  "phases": [
    {
      "id": "compact_spacious_one",
      "start": 0,
      "end": 15.67,
      "intent": "compact spacious one"
    },
    {
      "id": "compact_spacious_two",
      "start": 15.67,
      "end": 31.54,
      "intent": "compact spacious two"
    },
    {
      "id": "compact_drive",
      "start": 31.54,
      "end": 43.54,
      "intent": "compact drive"
    },
    {
      "id": "broad_release",
      "start": 43.54,
      "end": 60,
      "intent": "broad release"
    }
  ],
  "variant": {
    "parentId": "meter_exchange",
    "kind": "axis_offset",
    "rationale": "speed is shifted by 0.04 with clamping; rhythm and other authored axes remain fixed.",
    "parameters": {
      "axis": "speed",
      "offset": 0.04
    }
  }
},
  document: scoreDocument,
});

export default benchmarkCase.spec;
