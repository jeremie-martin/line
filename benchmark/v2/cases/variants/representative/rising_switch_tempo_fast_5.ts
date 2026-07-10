import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "rising_switch_tempo_fast_5",
  "title": "Rising Switch, 5% Faster",
  "duration": 55.1,
  "provenance": {
    "kind": "reference_informed_manual",
    "authoring_brief": "Cadence tightens in several independently phrased stages, crests, and releases without making every target jump at a boundary. Variant: The complete authored program is time-scaled by 0.95 while preserving phrase structure and axis intent."
  },
  "primary_family": "cadence_transition",
  "diagnostic_tags": [
    "tempo_change",
    "speed_density",
    "release"
  ],
  "pulse_regions": [
    {
      "start": 0.703,
      "end": 11.951,
      "pulse_seconds": 0.703,
      "intent": "wide opening cadence"
    },
    {
      "start": 11.951,
      "end": 21.527,
      "pulse_seconds": 0.598,
      "intent": "middle cadence"
    },
    {
      "start": 21.527,
      "end": 37.335,
      "pulse_seconds": 0.494,
      "intent": "driving crest"
    },
    {
      "start": 37.335,
      "end": 53.428,
      "pulse_seconds": 0.646,
      "intent": "measured release"
    }
  ],
  "phrases": {
    "wide": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.58
      },
      {
        "offset": 0.703,
        "role": "support",
        "impact": 0.3
      },
      {
        "offset": 1.406,
        "role": "accent",
        "impact": 0.7
      },
      {
        "offset": 2.109,
        "role": "support",
        "impact": 0.34
      },
      {
        "offset": 2.812,
        "role": "primary",
        "impact": 0.55
      },
      {
        "offset": 3.515,
        "role": "support",
        "impact": 0.27
      },
      {
        "offset": 4.218,
        "role": "accent",
        "impact": 0.66
      },
      {
        "offset": 4.921,
        "role": "reentry",
        "impact": 0.76
      }
    ],
    "middle": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.68
      },
      {
        "offset": 0.598,
        "role": "support",
        "impact": 0.36
      },
      {
        "offset": 1.197,
        "role": "accent",
        "impact": 0.75
      },
      {
        "offset": 1.795,
        "role": "support",
        "impact": 0.41
      },
      {
        "offset": 2.394,
        "role": "primary",
        "impact": 0.6
      },
      {
        "offset": 2.992,
        "role": "fill",
        "impact": 0.48
      },
      {
        "offset": 3.591,
        "role": "accent",
        "impact": 0.79
      },
      {
        "offset": 4.189,
        "role": "reentry",
        "impact": 0.84
      }
    ],
    "drive": [
      {
        "offset": 0,
        "role": "accent",
        "impact": 0.82
      },
      {
        "offset": 0.494,
        "role": "support",
        "impact": 0.43
      },
      {
        "offset": 0.988,
        "role": "primary",
        "impact": 0.67
      },
      {
        "offset": 1.482,
        "role": "support",
        "impact": 0.38
      },
      {
        "offset": 1.976,
        "role": "accent",
        "impact": 0.88
      },
      {
        "offset": 2.47,
        "role": "support",
        "impact": 0.46
      },
      {
        "offset": 2.964,
        "role": "primary",
        "impact": 0.71
      },
      {
        "offset": 3.458,
        "role": "reentry",
        "impact": 0.91
      }
    ],
    "release": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.72
      },
      {
        "offset": 0.646,
        "role": "support",
        "impact": 0.37
      },
      {
        "offset": 1.292,
        "role": "accent",
        "impact": 0.74
      },
      {
        "offset": 1.938,
        "role": "support",
        "impact": 0.33
      },
      {
        "offset": 2.584,
        "role": "primary",
        "impact": 0.56
      },
      {
        "offset": 3.23,
        "role": "tail",
        "impact": 0.29
      },
      {
        "offset": 3.876,
        "role": "tail",
        "impact": 0.22
      },
      {
        "offset": 4.522,
        "role": "tail",
        "impact": 0.16
      }
    ]
  },
  "placements": [
    {
      "at": 0.703,
      "phrase": "wide"
    },
    {
      "at": 6.327,
      "phrase": "wide"
    },
    {
      "at": 11.951,
      "phrase": "middle"
    },
    {
      "at": 16.739,
      "phrase": "middle"
    },
    {
      "at": 21.527,
      "phrase": "drive"
    },
    {
      "at": 25.479,
      "phrase": "drive"
    },
    {
      "at": 29.431,
      "phrase": "drive"
    },
    {
      "at": 33.383,
      "phrase": "drive"
    },
    {
      "at": 37.335,
      "phrase": "release"
    },
    {
      "at": 42.503,
      "phrase": "release"
    },
    {
      "at": 47.671,
      "phrase": "release"
    }
  ],
  "axes": {
    "air": [
      {
        "t": 0,
        "v": 0.46,
        "ease": "smooth",
        "intent": "wide cadence remains supported"
      },
      {
        "t": 15.2,
        "v": 0.62,
        "ease": "smooth",
        "intent": "middle opens gradually"
      },
      {
        "t": 28.5,
        "v": 0.68,
        "ease": "smooth",
        "intent": "drive has moderate air"
      },
      {
        "t": 40.85,
        "v": 0.58,
        "ease": "smooth",
        "intent": "release comes closer"
      },
      {
        "t": 55.1,
        "v": 0.72,
        "intent": "last release floats"
      }
    ],
    "speed": [
      {
        "t": 0,
        "v": 0.34,
        "ease": "smooth",
        "intent": "wide opening"
      },
      {
        "t": 11.951,
        "v": 0.52,
        "ease": "smooth",
        "intent": "first switch"
      },
      {
        "t": 21.527,
        "v": 0.7,
        "ease": "smooth",
        "intent": "drive begins"
      },
      {
        "t": 32.3,
        "v": 0.9,
        "ease": "easeOut",
        "intent": "cadence crest"
      },
      {
        "t": 41.8,
        "v": 0.76,
        "ease": "smooth",
        "intent": "release"
      },
      {
        "t": 55.1,
        "v": 0.56,
        "intent": "finish"
      }
    ]
  },
  "preroll": 5,
  "jitter": 0,
  "phases": [
    {
      "id": "wide_open",
      "start": 0,
      "end": 11.951,
      "intent": "wide open"
    },
    {
      "id": "middle_switch",
      "start": 11.951,
      "end": 21.527,
      "intent": "middle switch"
    },
    {
      "id": "driving_crest",
      "start": 21.527,
      "end": 37.335,
      "intent": "driving crest"
    },
    {
      "id": "measured_release",
      "start": 37.335,
      "end": 55.1,
      "intent": "measured release"
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
  "id": "rising_switch_tempo_fast_5",
  "title": "Rising Switch, 5% Faster",
  "originFamily": "cadence_transition",
  "phases": [
    {
      "id": "wide_open",
      "start": 0,
      "end": 11.951,
      "intent": "wide open"
    },
    {
      "id": "middle_switch",
      "start": 11.951,
      "end": 21.527,
      "intent": "middle switch"
    },
    {
      "id": "driving_crest",
      "start": 21.527,
      "end": 37.335,
      "intent": "driving crest"
    },
    {
      "id": "measured_release",
      "start": 37.335,
      "end": 55.1,
      "intent": "measured release"
    }
  ],
  "variant": {
    "parentId": "rising_switch",
    "kind": "global_tempo",
    "rationale": "The complete authored program is time-scaled by 0.95 while preserving phrase structure and axis intent.",
    "parameters": {
      "time_scale": 0.95
    }
  }
},
  document: scoreDocument,
});

export default benchmarkCase.spec;
